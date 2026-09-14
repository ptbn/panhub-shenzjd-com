// server/core/nas/types.ts
// NAS 驱动模型契约与数据结构定义

export interface PushTask {
  title: string;
  url: string;
  password?: string;
  category?: "movie" | "tv" | "anime" | "other";
  targetDir?: string;
  preferredClient?: "auto" | "alist" | "aria2" | "qbittorrent";
}

export interface PushResult {
  success: boolean;
  protocol: "alist" | "aria2" | "qbittorrent";
  taskId?: string;
  message: string;
  targetPath: string;
  targetDevice: string;
}

export interface NasProfilePublic {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  cloudDriveEnabled: boolean;
  alistUrl: string;
  alistHasToken: boolean;
  alistDefaultPath: string;
  torrentClientType: "aria2" | "qbittorrent";
  torrentClientUrl: string;
  torrentHasSecret: boolean;
  torrentDefaultDir: string;
  updatedAt: number;
}

export interface MountedMediaFile {
  name: string;
  size: number;
  isDir: boolean;
}

export interface ShareMountResult {
  success: boolean;
  message: string;
  storageId?: number;
  driver?: string;
  mountPath?: string;
  webdavUrl?: string;
  alistPlayUrl?: string;
  files?: MountedMediaFile[];
}
