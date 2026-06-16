/**
 * Stub for @matrix-org/matrix-sdk-crypto-wasm
 *
 * E2EE is disabled in this deployment (e2ee_enabled=false).
 * This stub prevents Vite from trying to load the 5.3MB .wasm binary.
 * RealMatrixClient never calls initRustCrypto(), so these are never invoked.
 *
 * All named exports referenced by matrix-js-sdk are listed here as no-ops
 * to satisfy Rollup's static analysis during production builds.
 */

// Enums
export const QrCodeMode = { Login: 0, Reciprocate: 1 };
export const QrState = {};
export const EncryptionAlgorithm = {};
export const CollectStrategy = {};
export const HistoryVisibility = {};

// Classes
export class Ecies {}
export class QrCodeData {}
export class OlmMachine {}
export class SecretsBundle {}
export class Curve25519PublicKey {}
export class EncryptionSettings {}
export class StoreHandle {}
export class UserId {}
export class RoomId {}

// Request types (classes used in instanceof checks or constructors)
export class KeysBackupRequest {}
export class KeysClaimRequest {}
export class KeysQueryRequest {}
export class KeysUploadRequest {}
export class RoomMessageRequest {}
export class SignatureUploadRequest {}
export class ToDeviceRequest {}
export class UploadSigningKeysRequest {}
export class PutDehydratedDeviceRequest {}
export class DeviceId {}
export class EventId {}
export class BackupDecryptionKey {}
export class DehydratedDeviceKey {}
export class DeviceLists {}
export class MegolmDecryptionError {}
export class OtherUserIdentity {}
export class OwnUserIdentity {}
export class PickledInboundGroupSession {}
export class PickledSession {}
export class QrCodeScan {}
export class RoomSettings {}
export class Sas {}
export class Qr {}

// Enums / const objects
export const BaseMigrationData = {};
export const DecryptionErrorCode = {};
export const DecryptionSettings = {};
export const LocalTrust = {};
export const Migration = {};
export const ProcessedToDeviceEventType = {};
export const ShieldColor = {};
export const ShieldStateCode = {};
export const TrustRequirement = {};
export const VerificationMethod = {};
export const VerificationRequestPhase = {};

// Functions
export async function initAsync() {}
export function getVersions() { return {}; }
