/**
 * Move to TypeScript type mapper
 */

import type {
  SuiMoveNormalizedType,
  SuiMoveNormalizedStructType,
} from '../types/sui.js';
import type { MappedType } from '../types/skill.js';
import {
  isPrimitive,
  isVector,
  isStruct,
  isTypeParameter,
  isReference,
  isMutableReference,
  WELL_KNOWN_TYPES,
} from '../types/sui.js';
import { TypeMappingError } from '../core/errors.js';

/**
 * Type mapper for converting Move types to TypeScript
 */
export class TypeMapper {
  private typeParamNames: Map<number, string>;

  constructor() {
    this.typeParamNames = new Map();
  }

  /**
   * Set type parameter names for current context
   */
  setTypeParameters(params: string[]): void {
    this.typeParamNames.clear();
    params.forEach((name, index) => {
      this.typeParamNames.set(index, name);
    });
  }

  /**
   * Map a Move type to TypeScript
   */
  mapType(moveType: SuiMoveNormalizedType): MappedType {
    return this.mapTypeInternal(moveType);
  }

  /**
   * Internal type mapping with recursion
   */
  private mapTypeInternal(moveType: SuiMoveNormalizedType): MappedType {
    // Primitive types
    if (isPrimitive(moveType)) {
      return this.mapPrimitive(moveType);
    }

    // Vector type
    if (isVector(moveType)) {
      return this.mapVector(moveType.Vector);
    }

    // Struct type
    if (isStruct(moveType)) {
      return this.mapStruct(moveType.Struct);
    }

    // Type parameter
    if (isTypeParameter(moveType)) {
      return this.mapTypeParameter(moveType.TypeParameter);
    }

    // Reference
    if (isReference(moveType)) {
      return this.mapReference(moveType.Reference, false);
    }

    // Mutable reference
    if (isMutableReference(moveType)) {
      return this.mapReference(moveType.MutableReference, true);
    }

    throw TypeMappingError.unknownType(moveType);
  }

  /**
   * Map primitive types
   */
  private mapPrimitive(type: string): MappedType {
    const PRIMITIVE_MAP: Record<string, MappedType> = {
      Bool: {
        ts: 'boolean',
        description: 'Boolean value',
      },
      U8: {
        ts: 'number',
        description: 'Unsigned 8-bit integer (0-255)',
      },
      U16: {
        ts: 'number',
        description: 'Unsigned 16-bit integer (0-65535)',
      },
      U32: {
        ts: 'number',
        description: 'Unsigned 32-bit integer',
      },
      U64: {
        ts: 'bigint | string',
        description: 'Unsigned 64-bit integer (use string for large values)',
      },
      U128: {
        ts: 'bigint | string',
        description: 'Unsigned 128-bit integer (use string)',
      },
      U256: {
        ts: 'bigint | string',
        description: 'Unsigned 256-bit integer (use string)',
      },
      Address: {
        ts: 'string',
        description: 'Sui address (0x...)',
      },
      Signer: {
        ts: 'string',
        description: 'Transaction signer address',
      },
    };

    const mapped = PRIMITIVE_MAP[type];
    if (!mapped) {
      throw TypeMappingError.unsupportedType(type);
    }

    return mapped;
  }

  /**
   * Map vector types
   */
  private mapVector(innerType: SuiMoveNormalizedType): MappedType {
    // Special case: vector<u8> is often bytes
    if (isPrimitive(innerType) && innerType === 'U8') {
      return {
        ts: 'Uint8Array | string',
        description: 'Byte array or hex string',
      };
    }

    const inner = this.mapTypeInternal(innerType);
    return {
      ts: `${inner.ts}[]`,
      description: `Array of ${inner.description.toLowerCase()}`,
    };
  }

  /**
   * Map struct types
   */
  private mapStruct(struct: SuiMoveNormalizedStructType): MappedType {
    // Normalize address (remove leading zeros)
    const normalizedAddress = this.normalizeAddress(struct.address);
    const fullPath = `${normalizedAddress}::${struct.module}::${struct.name}`;

    // Check for well-known system types
    const wellKnown = this.mapWellKnownType(struct, fullPath);
    if (wellKnown) {
      return wellKnown;
    }

    // Generic struct - treat as object reference
    const typeArgs = struct.typeArguments.map((arg) => this.mapTypeInternal(arg).ts);
    const typeArgsStr = typeArgs.length > 0 ? `<${typeArgs.join(', ')}>` : '';

    return {
      ts: 'string',
      description: `${struct.name}${typeArgsStr} object ID`,
      isObjectRef: true,
      moveType: `${struct.module}::${struct.name}${typeArgsStr}`,
    };
  }

  /**
   * Map well-known system types
   */
  private mapWellKnownType(
    struct: SuiMoveNormalizedStructType,
    _fullPath: string
  ): MappedType | null {

    // Coin type
    if (this.isType(struct, WELL_KNOWN_TYPES.COIN)) {
      const coinType = struct.typeArguments[0];
      const coinTypeStr = coinType ? this.formatMoveType(coinType) : 'unknown';
      return {
        ts: 'string',
        description: `Coin<${coinTypeStr}> object ID - pass the object ID of a Coin you own`,
        isObjectRef: true,
        moveType: `coin::Coin<${coinTypeStr}>`,
      };
    }

    // Clock type
    if (this.isType(struct, WELL_KNOWN_TYPES.CLOCK)) {
      return {
        ts: "'0x6'",
        description: 'System clock object - always pass "0x6"',
        isSystemObject: true,
        defaultValue: '0x6',
      };
    }

    // TxContext type
    if (this.isType(struct, WELL_KNOWN_TYPES.TX_CONTEXT)) {
      return {
        ts: 'void',
        description: 'Transaction context - automatically injected, do not pass',
        isAutoInjected: true,
      };
    }

    // Object ID type
    if (this.isType(struct, WELL_KNOWN_TYPES.OBJECT_ID)) {
      return {
        ts: 'string',
        description: 'Object ID (0x...)',
      };
    }

    // String types
    if (
      this.isType(struct, WELL_KNOWN_TYPES.STRING) ||
      this.isType(struct, WELL_KNOWN_TYPES.ASCII_STRING)
    ) {
      return {
        ts: 'string',
        description: 'UTF-8 string',
      };
    }

    // Option type
    if (this.isType(struct, WELL_KNOWN_TYPES.OPTION)) {
      const innerType = struct.typeArguments[0];
      if (innerType) {
        const inner = this.mapTypeInternal(innerType);
        return {
          ts: `${inner.ts} | null`,
          description: `Optional ${inner.description.toLowerCase()}`,
        };
      }
      return {
        ts: 'unknown | null',
        description: 'Optional value',
      };
    }

    return null;
  }

  /**
   * Map type parameters
   */
  private mapTypeParameter(index: number): MappedType {
    const name = this.typeParamNames.get(index) ?? `T${index}`;
    return {
      ts: name,
      description: `Type parameter ${name}`,
    };
  }

  /**
   * Map reference types
   */
  private mapReference(innerType: SuiMoveNormalizedType, isMutable: boolean): MappedType {
    const inner = this.mapTypeInternal(innerType);

    // References to structs are typically object IDs
    if (isStruct(innerType)) {
      return {
        ...inner,
        description: `${isMutable ? 'Mutable reference to' : 'Reference to'} ${inner.description}`,
        isMutable,
        isObjectRef: true,
      };
    }

    return {
      ...inner,
      description: `${isMutable ? 'Mutable reference to' : 'Reference to'} ${inner.description}`,
      isMutable,
    };
  }

  /**
   * Check if struct matches a well-known type
   */
  private isType(
    struct: SuiMoveNormalizedStructType,
    wellKnown: { address: string; module: string; name: string }
  ): boolean {
    const normalizedAddress = this.normalizeAddress(struct.address);
    return (
      normalizedAddress === wellKnown.address &&
      struct.module === wellKnown.module &&
      struct.name === wellKnown.name
    );
  }

  /**
   * Normalize Sui address (handle full and short forms)
   */
  private normalizeAddress(address: string): string {
    // Remove 0x prefix, remove leading zeros, add 0x back
    const hex = address.replace(/^0x/, '');
    const trimmed = hex.replace(/^0+/, '') || '0';

    // Special case for well-known addresses
    if (trimmed === '1' || trimmed === '2' || trimmed === '6') {
      return `0x${trimmed}`;
    }

    return `0x${trimmed}`;
  }

  /**
   * Format Move type as string
   */
  formatMoveType(type: SuiMoveNormalizedType): string {
    if (isPrimitive(type)) {
      return type.toLowerCase();
    }

    if (isVector(type)) {
      return `vector<${this.formatMoveType(type.Vector)}>`;
    }

    if (isStruct(type)) {
      const struct = type.Struct;
      const typeArgs = struct.typeArguments.map((arg) => this.formatMoveType(arg));
      const typeArgsStr = typeArgs.length > 0 ? `<${typeArgs.join(', ')}>` : '';
      return `${struct.module}::${struct.name}${typeArgsStr}`;
    }

    if (isTypeParameter(type)) {
      return this.typeParamNames.get(type.TypeParameter) ?? `T${type.TypeParameter}`;
    }

    if (isReference(type)) {
      return `&${this.formatMoveType(type.Reference)}`;
    }

    if (isMutableReference(type)) {
      return `&mut ${this.formatMoveType(type.MutableReference)}`;
    }

    return 'unknown';
  }

  /**
   * Check if a type is a system object that should be auto-provided
   */
  isSystemObject(type: SuiMoveNormalizedType): boolean {
    if (!isStruct(type)) {
      if (isReference(type)) {
        return this.isSystemObject(type.Reference);
      }
      if (isMutableReference(type)) {
        return this.isSystemObject(type.MutableReference);
      }
      return false;
    }

    const struct = type.Struct;
    return (
      this.isType(struct, WELL_KNOWN_TYPES.CLOCK) ||
      this.isType(struct, WELL_KNOWN_TYPES.TX_CONTEXT)
    );
  }

  /**
   * Check if a type should be auto-injected (not provided by user)
   */
  isAutoInjected(type: SuiMoveNormalizedType): boolean {
    if (!isStruct(type)) {
      if (isReference(type)) {
        return this.isAutoInjected(type.Reference);
      }
      if (isMutableReference(type)) {
        return this.isAutoInjected(type.MutableReference);
      }
      return false;
    }

    return this.isType(type.Struct, WELL_KNOWN_TYPES.TX_CONTEXT);
  }

  /**
   * Check if type requires an object ID
   */
  requiresObjectId(type: SuiMoveNormalizedType): boolean {
    if (isStruct(type)) {
      // Most struct types require object ID except primitives
      const struct = type.Struct;
      if (
        this.isType(struct, WELL_KNOWN_TYPES.STRING) ||
        this.isType(struct, WELL_KNOWN_TYPES.ASCII_STRING) ||
        this.isType(struct, WELL_KNOWN_TYPES.OBJECT_ID)
      ) {
        return false;
      }
      return true;
    }

    if (isReference(type)) {
      return this.requiresObjectId(type.Reference);
    }

    if (isMutableReference(type)) {
      return this.requiresObjectId(type.MutableReference);
    }

    return false;
  }
}

/**
 * Create a type mapper instance
 */
export function createTypeMapper(): TypeMapper {
  return new TypeMapper();
}

/**
 * Map a single type (convenience function)
 */
export function mapMoveType(type: SuiMoveNormalizedType): MappedType {
  const mapper = new TypeMapper();
  return mapper.mapType(type);
}
