export type BkpMotor = 'POSTGRESQL'|'MYSQL'|string;
export type BkpStorageType = 'LOCAL'|'SFTP'|'SSH'|'GOOGLE_DRIVE'|'S3'|'MEGA'|'FTP'|'OTHER'|string;
export type BkpRunStatus = 'PENDING'|'RUNNING'|'SUCCESS'|'FAILED'|'PARTIAL_SUCCESS'|'CANCELLED'|string;

export type BkpCatalogs = {
  motores: string[];
  herramientas: string[];
  storageTypes: string[];
  implementedStorageTypes?: string[];
  providerTypes?: string[];
  scheduleTypes: string[];
  backupTypes: string[];
  formatosSalida: string[];
  compressionTypes: string[];
  statusRun: string[];
  canales: string[];
  eventTypes: string[];
};

export type BkpSecret = { idBkpSecret: number; nombre: string; tipoSecret: string; algoritmo?: string|null; descripcion?: string|null; activo?: boolean; fecGen?: string|null; fecFin?: string|null; };
export type BkpSecretGuardarRequest = { nombre: string; tipoSecret: string; valorPlano: string; algoritmo?: string|null; descripcion?: string|null; activo?: boolean; };
export type BkpSecretEditarRequest = { idBkpSecret: number; valorPlano?: string|null; cambios?: Record<string,unknown>; };

export type BkpAgentNode = { idBkpAgentNode: number; nombre: string; hostname?: string|null; ipAddress?: string|null; osType: string; workDir?: string|null; tempDir?: string|null; logDir?: string|null; maxParallelJobs?: number|null; heartbeatAt?: string|null; metadata?: Record<string,unknown>|null; observacion?: string|null; activo?: boolean; executionMode?: string|null; sshHost?: string|null; sshPort?: number|null; sshUsername?: string|null; sshAuthType?: string|null; idBkpSecretSshFk?: number|null; sshIdentityFile?: string|null; sshStrictHostKey?: boolean|null; sshKnownHosts?: string|null; sshConnectTimeoutSeconds?: number|null; };
export type BkpEngineTool = { idBkpEngineTool: number; idBkpAgentNodeFk: number; motor: BkpMotor; herramienta: string; binaryPath: string; versionText?: string|null; configJson?: Record<string,unknown>|null; activo?: boolean; };
export type BkpSourceDatabase = { idBkpSourceDatabase: number; nombre: string; motor: BkpMotor; host: string; puerto: number; nombreBase: string; nombreSchema?: string|null; usuario: string; idBkpSecretPasswordFk?: number|null; sslEnabled?: boolean; connectionParams?: Record<string,unknown>|null; observacion?: string|null; activo?: boolean; };
export type BkpSchedule = { idBkpSchedule: number; nombre: string; tipoSchedule: string; cronExpression?: string|null; intervalMinutes?: number|null; hora?: number|null; minuto?: number|null; diasSemana?: string|null; diaMes?: number|null; timezone?: string|null; activo?: boolean; };
export type BkpIntegrationProvider = { idBkpIntegrationProvider: number; nombre: string; providerType: string; baseUrl?: string|null; sessionName?: string|null; idBkpSecretAuthFk?: number|null; configJson?: Record<string,unknown>|null; activo?: boolean; };
export type BkpStorageDestination = { idBkpStorageDestination: number; nombre: string; tipoStorage: BkpStorageType; idBkpIntegrationProviderFk?: number|null; basePath?: string|null; bucketName?: string|null; prefixPath?: string|null; folderId?: string|null; idBkpSecretCredentialFk?: number|null; configJson?: Record<string,unknown>|null; retentionDays?: number|null; immutableEnabled?: boolean; immutableDays?: number|null; activo?: boolean; };

export type BkpPlanTableFilterRequest = { schemaName?: string|null; tableName: string; filterType: string; };
export type BkpPlanScopeRequest = { scopeType: string; includeOwner?: boolean; includePrivileges?: boolean; configJson?: Record<string,unknown>|null; tableFilters?: BkpPlanTableFilterRequest[]; };
export type BkpPlan = { idBkpPlan: number; nombre: string; idBkpSourceDatabaseFk: number; idBkpScheduleFk?: number|null; idBkpAgentNodeFk?: number|null; tipoBackup?: string|null; formatoSalida?: string|null; compressionEnabled?: boolean; compressionType?: string|null; encryptionEnabled?: boolean; idBkpSecretEncryptionFk?: number|null; verifyAfterBackup?: boolean; calculateChecksum?: boolean; localTempPath?: string|null; localRetentionDays?: number|null; maxRuntimeMinutes?: number|null; extraDumpArgs?: string|null; activo?: boolean; };
export type BkpPlanGuardarRequest = Omit<BkpPlan,'idBkpPlan'> & { scope?: BkpPlanScopeRequest|null; destinationIds?: number[]; };
export type BkpPlanDestination = { idBkpPlanDestination: number; idBkpPlanFk: number; idBkpStorageDestinationFk: number; prioridad?: number|null; obligatorio?: boolean; activo?: boolean; };
export type BkpPlanDetalle = { plan: BkpPlan; scopes?: unknown[]; destinations?: BkpPlanDestination[]; };

export type BkpRunResumen = { idBkpRun: number; idBkpPlanFk: number; planNombre: string; idBkpSourceDatabaseFk: number; sourceNombre: string; sourceMotor: string; sourceHost: string; sourcePuerto: number; sourceBase: string; status: BkpRunStatus; triggerType?: string|null; queuedAt?: string|null; startedAt?: string|null; finishedAt?: string|null; fileName?: string|null; fileSizeBytes?: number|null; checksumSha256?: string|null; errorMessage?: string|null; totalUploads?: number|null; uploadsSuccess?: number|null; uploadsFailed?: number|null; };
export type BkpRun = BkpRunResumen & { idBkpAgentNodeFk?: number|null; requestedBy?: number|null; dumpStartedAt?: string|null; dumpFinishedAt?: string|null; compressionStartedAt?: string|null; compressionFinishedAt?: string|null; encryptionStartedAt?: string|null; encryptionFinishedAt?: string|null; verifyStartedAt?: string|null; verifyFinishedAt?: string|null; localFilePath?: string|null; fileExtension?: string|null; checksumMd5?: string|null; commandPreview?: string|null; exitCode?: number|null; errorDetail?: string|null; metadata?: Record<string,unknown>|null; };
export type BkpUploadRun = { idBkpUploadRun: number; idBkpRunFk: number; idBkpStorageDestinationFk: number; status: string; uploadStartedAt?: string|null; uploadFinishedAt?: string|null; remotePath?: string|null; remoteFileId?: string|null; remoteUrl?: string|null; bytesUploaded?: number|null; checksumRemoteSha256?: string|null; retryCount?: number|null; errorMessage?: string|null; errorDetail?: string|null; metadata?: Record<string,unknown>|null; };

export type BkpNotificationContact = { idBkpNotificationContact: number; nombre: string; canal: string; destinatario: string; activo?: boolean; };
export type BkpNotificationRule = { idBkpNotificationRule: number; nombre: string; eventType: string; idBkpNotificationContactFk: number; idBkpIntegrationProviderFk?: number|null; onlyForPlanId?: number|null; activo?: boolean; };
export type BkpNotificationRun = { idBkpNotificationRun: number; idBkpRunFk?: number|null; idBkpUploadRunFk?: number|null; idBkpNotificationContactFk?: number|null; canal: string; destinatario: string; status: string; asunto?: string|null; mensaje?: string|null; sentAt?: string|null; errorMessage?: string|null; errorDetail?: string|null; metadata?: Record<string,unknown>|null; fecGen?: string|null; };
export type BkpRunDetail = { run: BkpRun; uploads: BkpUploadRun[]; notifications: BkpNotificationRun[]; };

export type BkpRestoreRequest = { idBkpRun: number; idBkpAgentNode?: number|null; restoreType: 'TEST'|'DRILL'|'REAL'|string; targetHost?: string|null; targetPort?: number|null; targetDatabase?: string|null; targetSchema?: string|null; targetUsuario?: string|null; idBkpSecretPassword?: number|null; cleanBeforeRestore?: boolean|null; executeNow?: boolean|null; extraRestoreArgs?: string|null; };
export type BkpRestoreRun = { idBkpRestoreRun: number; idBkpRunFk: number; idBkpAgentNodeFk?: number|null; status: string; restoreType: string; targetHost?: string|null; targetPort?: number|null; targetDatabase?: string|null; targetSchema?: string|null; startedAt?: string|null; finishedAt?: string|null; commandPreview?: string|null; exitCode?: number|null; validationResult?: Record<string,unknown>|null; errorMessage?: string|null; errorDetail?: string|null; metadata?: Record<string,unknown>|null; };

export type BkpRetentionRun = { idBkpRetentionRun: number; idBkpStorageDestinationFk?: number|null; status: string; startedAt?: string|null; finishedAt?: string|null; retentionDays?: number|null; filesScanned?: number|null; filesDeleted?: number|null; bytesDeleted?: number|null; errorMessage?: string|null; errorDetail?: string|null; metadata?: Record<string,unknown>|null; };

export type BkpGeneralConfig = { idBkpGeneralConfig: number; companyName?: string|null; responsibleName?: string|null; defaultTimezone?: string|null; defaultRetentionDays?: number|null; notifyOnSuccess?: boolean; notifyOnError?: boolean; maxParallelBackups?: number|null; defaultLocalTempPath?: string|null; configJson?: Record<string,unknown>|null; activo?: boolean; };
