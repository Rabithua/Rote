export type Tag = {
  value: string;
  label: string;
};

export type Tags = Tag[];

export type TagsAction =
  | { type: "addOne"; tag: string }
  | { type: "addMore"; tags: Tags }
  | { type: "deleted"; tag: string };

export type Rote = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  content: string;
  state: string;
  authorid: string;
  pin: boolean;
  editor: string;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    nickname: string;
    avatar: string;
  };
  attachments: any[]; // 你可以根据实际情况定义attachments的类型
  userreaction: any[]; // 你可以根据实际情况定义userreaction的类型
  visitorreaction: any[]; // 你可以根据实际情况定义visitorreaction的类型
};

export type Rotes = Rote[];

export type RotesAction =
  | { type: "addOne"; rote: Rote }
  | { type: "add"; rotes: Rotes }
  | { type: "freshAll"; rotes: Rotes }
  | { type: "updateOne"; rote: Rote }
  | { type: "deleted"; roteid: string[] };

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

export type ProfileAction = { type: "updateProfile"; profile: Profile };
