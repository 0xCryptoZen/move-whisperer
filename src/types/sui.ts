/**
 * Sui Move type definitions
 * Based on Sui RPC response types from getNormalizedMoveModule
 */

// Network types
export type Network = 'mainnet' | 'testnet' | 'devnet';

export const NETWORK_URLS: Record<Network, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io',
  testnet: 'https://fullnode.testnet.sui.io',
  devnet: 'https://fullnode.devnet.sui.io',
};

// Module identifier
export interface SuiModuleId {
  address: string;
  name: string;
}

// Normalized module from RPC
export interface SuiNormalizedModule {
  fileFormatVersion: number;
  address: string;
  name: string;
  friends: SuiModuleId[];
  structs: Record<string, SuiNormalizedStruct>;
  exposedFunctions: Record<string, SuiNormalizedFunction>;
}

// Function definition
export interface SuiNormalizedFunction {
  visibility: SuiMoveVisibility;
  isEntry: boolean;
  typeParameters: SuiMoveAbilitySet[];
  parameters: SuiMoveNormalizedType[];
  return: SuiMoveNormalizedType[];
}

// Visibility types
export type SuiMoveVisibility = 'Public' | 'Private' | 'Friend';

// Struct definition
export interface SuiNormalizedStruct {
  abilities: SuiMoveAbilities;
  typeParameters: SuiMoveStructTypeParameter[];
  fields: SuiMoveNormalizedField[];
}

export interface SuiMoveNormalizedField {
  name: string;
  type: SuiMoveNormalizedType;
}

// Type parameters and abilities
export interface SuiMoveStructTypeParameter {
  constraints: SuiMoveAbilities;
  isPhantom: boolean;
}

export interface SuiMoveAbilitySet {
  abilities: SuiMoveAbility[];
}

export interface SuiMoveAbilities {
  abilities: SuiMoveAbility[];
}

export type SuiMoveAbility = 'Copy' | 'Drop' | 'Store' | 'Key';

// Normalized type - the core type representation
export type SuiMoveNormalizedType =
  | 'Bool'
  | 'U8'
  | 'U16'
  | 'U32'
  | 'U64'
  | 'U128'
  | 'U256'
  | 'Address'
  | 'Signer'
  | { Vector: SuiMoveNormalizedType }
  | { Struct: SuiMoveNormalizedStructType }
  | { TypeParameter: number }
  | { Reference: SuiMoveNormalizedType }
  | { MutableReference: SuiMoveNormalizedType };

// Struct type reference
export interface SuiMoveNormalizedStructType {
  address: string;
  module: string;
  name: string;
  typeArguments: SuiMoveNormalizedType[];
}

// Primitive type literals
export type SuiMovePrimitiveType =
  | 'Bool'
  | 'U8'
  | 'U16'
  | 'U32'
  | 'U64'
  | 'U128'
  | 'U256'
  | 'Address'
  | 'Signer';

// Helper type guards
export function isPrimitive(type: SuiMoveNormalizedType): type is SuiMovePrimitiveType {
  return typeof type === 'string';
}

export function isVector(
  type: SuiMoveNormalizedType
): type is { Vector: SuiMoveNormalizedType } {
  return typeof type === 'object' && 'Vector' in type;
}

export function isStruct(
  type: SuiMoveNormalizedType
): type is { Struct: SuiMoveNormalizedStructType } {
  return typeof type === 'object' && 'Struct' in type;
}

export function isTypeParameter(
  type: SuiMoveNormalizedType
): type is { TypeParameter: number } {
  return typeof type === 'object' && 'TypeParameter' in type;
}

export function isReference(
  type: SuiMoveNormalizedType
): type is { Reference: SuiMoveNormalizedType } {
  return typeof type === 'object' && 'Reference' in type;
}

export function isMutableReference(
  type: SuiMoveNormalizedType
): type is { MutableReference: SuiMoveNormalizedType } {
  return typeof type === 'object' && 'MutableReference' in type;
}

// Well-known addresses
export const WELL_KNOWN_ADDRESSES = {
  SUI_FRAMEWORK: '0x2',
  MOVE_STDLIB: '0x1',
  CLOCK_OBJECT: '0x6',
} as const;

// Well-known types
export const WELL_KNOWN_TYPES = {
  COIN: { address: '0x2', module: 'coin', name: 'Coin' },
  CLOCK: { address: '0x2', module: 'clock', name: 'Clock' },
  TX_CONTEXT: { address: '0x2', module: 'tx_context', name: 'TxContext' },
  OBJECT_ID: { address: '0x2', module: 'object', name: 'ID' },
  STRING: { address: '0x1', module: 'string', name: 'String' },
  ASCII_STRING: { address: '0x1', module: 'ascii', name: 'String' },
  OPTION: { address: '0x1', module: 'option', name: 'Option' },
} as const;
