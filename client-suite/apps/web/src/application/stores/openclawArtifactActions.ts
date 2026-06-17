/**
 * openclawArtifactActions —— App / Document / Board 三类展示聚合 CRUD
 *
 * 从 openclawStore 拆分。这三类是「只读展示聚合」（详见 openclawStore.ts 演进
 * 路线图阶段 2），彼此同质，合并到本文件。当前仅本地 state 写入，无跨切片
 * 事务、无 API 调用。
 */
import type { StoreSet, StoreGet } from './openclawTypes';
import type { AppArtifact, DocumentArtifact } from './openclawTypes';
import type { ProjectBoard } from '../../domain/agent/ProjectBoard';

export function artifactActions(set: StoreSet, get: StoreGet) {
  return {
    addApp(app: AppArtifact) {
      set({ apps: [...get().apps, app] });
    },
    updateApp(appId: string, updater: (a: AppArtifact) => AppArtifact) {
      set({ apps: get().apps.map((a) => (a.id === appId ? updater(a) : a)) });
    },
    addDocument(doc: DocumentArtifact) {
      set({ documents: [...get().documents, doc] });
    },
    updateDocument(docId: string, updater: (d: DocumentArtifact) => DocumentArtifact) {
      set({ documents: get().documents.map((d) => (d.id === docId ? updater(d) : d)) });
    },
    addBoard(board: ProjectBoard) {
      set({ boards: [...get().boards, board] });
    },
    updateBoard(boardId: string, updater: (b: ProjectBoard) => ProjectBoard) {
      set({ boards: get().boards.map((b) => (b.id === boardId ? updater(b) : b)) });
    },
  };
}
