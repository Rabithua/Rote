export type Tag = {
  value: string;
  label: string;
};

export type RoteState = 'private' | 'public';

export type Tags = Tag[];

export type TagsAction =
  | { type: 'addOne'; tag: Tag }
  | { type: 'addMore'; tags: Tags }
  | { type: 'deleted'; tag: Tag }
  | { type: 'freshAll'; tags: Tags };

export interface Reaction {
  id: string;
  type: string; // 支持任意 Emoji 或反应类型字符串
  roteid: string;
  userid?: string;
  visitorId?: string;
  visitorInfo?: any; // 存储访客的额外信息（IP、User-Agent等）
  metadata?: any; // 可以存储额外的反应数据
  createdAt: string;
  updatedAt: string;
}

export type Rote = {
  id: string;
  title?: string;
  type?: 'Rote';
  tags: string[];
  content: string;
  state: RoteState;
  archived: boolean;
  authorid?: string;
  pin: boolean;
  editor?: string;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    nickname: string;
    avatar: string;
  };
  attachments: (Attachment | File)[];
  reactions: Reaction[];
};

export type Attachment = {
  id: string;
  url: string;
  compressUrl: string;
  userid: string;
  roteid: string;
  storage: string;
  details: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    bucket: string;
    key: string;
    acl: string;
    contentType: string;
    contentDisposition: string | null;
    contentEncoding: string | null;
    storageClass: string;
    serverSideEncryption: string | null;
    metadata: {
      fieldName: string;
    };
    location: string;
    etag: string;
    versionId: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type Rotes = Rote[];

export type RotesAction =
  | { type: 'addOne'; rote: Rote }
  | { type: 'add'; rotes: Rotes }
  | { type: 'freshAll'; rotes: Rotes }
  | { type: 'updateOne'; rote: Rote }
  | { type: 'deleted'; roteid: string[] };

export type Profile =
  | {
      id: string;
      email: string;
      username: string;
      nickname: string;
      description: string;
      cover: string;
      avatar: string;
      createdAt: string;
      updatedAt: string;
    }
  | undefined;

export type ProfileAction =
  | { type: 'updateProfile'; profile: Profile }
  | { type: 'setLoading'; isLoading: boolean }
  | { type: 'setError'; error: string };

export type OpenKey = {
  id: string;
  userid: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

export type OpenKeys = OpenKey[];

export type OpenKeysAction =
  | { type: 'addOne'; openKey: OpenKey }
  | { type: 'addMore'; openKeys: OpenKeys }
  | { type: 'init'; openKeys: OpenKeys }
  | { type: 'updateOne'; openKey: OpenKey }
  | { type: 'delete'; openKeyid: string };

export type HeatMapDay = {
  date: Date;
  notesCount: number;
};

export type EditorType = {
  tags: string[];
  content: string;
  state: RoteState;
  archived: boolean;
  pin: boolean;
  type: 'rote';
};

export type TempState = {
  sendNewOne: null | Rote;
  editOne: null | Rote;
  removeOne: null | string;
  newAttachments: null | Attachment[];
};

export type ApiGetRotesParams = {
  archived?: boolean;
  apiType?: 'mine' | 'public' | 'userPublic';
  params?: {
    username?: string;
    limit?: number;
    skip?: number;
    archived?: boolean;
    tag?: string | string[];
    keyword?: string;
  };
};

export type Statistics = {
  noteCount: number;
  attachmentsCount: number;
};

export interface Subscription {
  keys: {
    auth: string;
    p256dh: string;
  };
  id: string;
  userid: string;
  endpoint: string;
  status?: string;
  note?: string;
  expirationTime: string | null;
  createdAt: string;
  updatedAt: string;
}
