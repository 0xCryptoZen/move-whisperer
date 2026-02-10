'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  metadata?: {
    title: string;
    description: string;
    packageId?: string;
    scene?: string;
    network?: string;
  };
}

export default function SubmitSkillPage() {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!githubUrl.trim()) return;

    setValidating(true);
    setValidation(null);
    setError(null);

    try {
      // Call validation API
      const response = await fetch('/api/marketplace/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: githubUrl.trim() }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Validation failed');
      }

      const result = await response.json() as ValidationResult;
      setValidation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!validation?.isValid) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/marketplace/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUrl: githubUrl.trim(),
          title: validation.metadata?.title,
          description: validation.metadata?.description,
          scene: validation.metadata?.scene,
          network: validation.metadata?.network,
          packageId: validation.metadata?.packageId,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Submission failed');
      }

      router.push('/marketplace?submitted=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <Link
              href="/marketplace"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Submit a Skill</h1>
              <p className="text-muted-foreground text-sm">
                Share your Claude skill with the community
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="glass-panel rounded-2xl p-6">
          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              GitHub URL to SKILL.md
            </label>
            <input
              type="url"
              placeholder="https://github.com/username/repo/blob/main/SKILL.md"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value);
                setValidation(null);
              }}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter the full URL to your SKILL.md file on GitHub
            </p>
          </div>

          {/* Validate Button */}
          <button
            onClick={handleValidate}
            disabled={!githubUrl.trim() || validating}
            className={`w-full py-3 rounded-xl font-medium transition-all ${
              !githubUrl.trim() || validating
                ? 'bg-white/5 text-muted-foreground cursor-not-allowed'
                : 'bg-primary/20 text-primary hover:bg-primary/30'
            }`}
          >
            {validating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Validating...
              </span>
            ) : (
              'Validate SKILL.md'
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Validation Result */}
          {validation && (
            <div className={`mt-6 p-4 rounded-xl ${
              validation.isValid
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {validation.isValid ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="font-semibold text-green-400">Valid SKILL.md</h3>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Title:</span>
                      <span>{validation.metadata?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scene:</span>
                      <span>{validation.metadata?.scene || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Network:</span>
                      <span>{validation.metadata?.network || 'N/A'}</span>
                    </div>
                    {validation.metadata?.packageId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Package:</span>
                        <span className="font-mono text-xs">
                          {validation.metadata.packageId.slice(0, 10)}...
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full py-3 rounded-xl font-medium transition-all ${
                      submitting
                        ? 'bg-green-500/50 cursor-wait'
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit to Marketplace'
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="font-semibold text-red-400">Validation Failed</h3>
                  </div>
                  <ul className="space-y-1 text-sm text-red-400/80">
                    {validation.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Guidelines */}
        <div className="mt-8 glass-panel rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Submission Guidelines</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              SKILL.md must be in a public GitHub repository
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Include a YAML frontmatter with name, description, and scene
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Provide clear documentation and examples
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Keep the skill focused on a specific contract or use case
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
