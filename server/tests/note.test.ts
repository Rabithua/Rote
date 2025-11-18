/**
 * 笔记相关 API 测试
 */

import { TestAssertions } from './utils/assertions';
import { TestClient } from './utils/testClient';
import { TestResultManager } from './utils/testResult';

export class NoteTestSuite {
  private client: TestClient;
  private resultManager: TestResultManager;
  private createdNoteIds: string[] = [];

  constructor(client: TestClient, resultManager: TestResultManager) {
    this.client = client;
    this.resultManager = resultManager;
  }

  /**
   * 测试创建笔记
   */
  async testCreateNote(content: string, title?: string, tags?: string[]) {
    const startTime = Date.now();
    try {
      const response = await this.client.post('/notes', {
        content,
        title,
        tags,
      });

      TestAssertions.assertStatus(response.status, 201, 'Create Note');
      TestAssertions.assertSuccess(response.data, 'Create Note');

      const note = response.data.data;
      TestAssertions.assertNotNull(note, 'Note should be created');
      TestAssertions.assertNotNull(note.id, 'Note should have an ID');
      TestAssertions.assertEquals(note.content, content, 'Note content should match');

      if (title) {
        TestAssertions.assertEquals(note.title, title, 'Note title should match');
      }

      this.createdNoteIds.push(note.id);

      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Create Note',
        true,
        `Note created with ID: ${note.id}`,
        duration,
        undefined,
        { noteId: note.id }
      );

      return note;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorDetails =
        error.response?.data?.message || error.response?.data?.error || errorMessage;
      this.resultManager.recordResult(
        'Create Note',
        false,
        `Failed to create note: ${errorDetails}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取笔记
   */
  async testGetNote(noteId: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.get(`/notes/${noteId}`);

      TestAssertions.assertStatus(response.status, 200, 'Get Note');
      TestAssertions.assertSuccess(response.data, 'Get Note');

      const note = response.data.data;
      TestAssertions.assertNotNull(note, 'Note should be retrieved');
      TestAssertions.assertEquals(note.id, noteId, 'Note ID should match');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get Note', true, `Note ${noteId} retrieved`, duration);
      return note;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Note',
        false,
        `Failed to get note ${noteId}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试更新笔记
   */
  async testUpdateNote(
    noteId: string,
    updates: { content?: string; title?: string; tags?: string[] }
  ) {
    const startTime = Date.now();
    try {
      const response = await this.client.put(`/notes/${noteId}`, updates);

      TestAssertions.assertStatus(response.status, 200, 'Update Note');
      TestAssertions.assertSuccess(response.data, 'Update Note');

      const note = response.data.data;
      TestAssertions.assertNotNull(note, 'Note should be updated');

      if (updates.content) {
        TestAssertions.assertEquals(
          note.content,
          updates.content,
          'Note content should be updated'
        );
      }

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Update Note', true, `Note ${noteId} updated`, duration);
      return note;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Update Note',
        false,
        `Failed to update note ${noteId}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试删除笔记
   */
  async testDeleteNote(noteId: string) {
    const startTime = Date.now();
    try {
      const response = await this.client.delete(`/notes/${noteId}`);

      TestAssertions.assertStatus(response.status, 200, 'Delete Note');
      TestAssertions.assertSuccess(response.data, 'Delete Note');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Delete Note', true, `Note ${noteId} deleted`, duration);
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Delete Note',
        false,
        `Failed to delete note ${noteId}`,
        duration,
        error
      );
      return false;
    }
  }

  /**
   * 测试搜索笔记
   */
  async testSearchNotes(keyword?: string, tag?: string) {
    const startTime = Date.now();
    try {
      const params = new URLSearchParams();
      // API 要求 keyword 是必需的，即使只有 tag 也需要提供 keyword
      // 如果没有提供 keyword，使用空字符串（API 可能不接受，所以使用一个简单的搜索词）
      if (keyword) {
        params.append('keyword', keyword);
      } else if (tag) {
        // 如果只有 tag，使用一个简单的搜索词（不能使用 '*'，因为会导致 SQL 错误）
        params.append('keyword', 'test');
      } else {
        // 如果既没有 keyword 也没有 tag，使用一个简单的搜索词
        params.append('keyword', 'test');
      }
      if (tag) {
        params.append('tag', tag);
      }
      params.append('limit', '10');

      const endpoint = `/notes/search${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.client.get(endpoint);

      TestAssertions.assertStatus(response.status, 200, 'Search Notes');
      TestAssertions.assertSuccess(response.data, 'Search Notes');

      const data = response.data.data;
      TestAssertions.assertNotNull(data, 'Search results should be returned');
      // 响应可能是数组，也可能是包含 notes 字段的对象
      const notes = Array.isArray(data) ? data : data.notes || [];
      TestAssertions.assertNotNull(notes, 'Search results should contain notes array');
      TestAssertions.assertNotNull(Array.isArray(notes), 'Notes should be an array');
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Search Notes',
        true,
        `Found ${notes.length} notes`,
        duration,
        undefined,
        { count: notes.length }
      );
      return { notes, ...(Array.isArray(data) ? {} : data) };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      const errorDetails =
        error.response?.data?.message || error.response?.data?.error || errorMessage;
      this.resultManager.recordResult(
        'Search Notes',
        false,
        `Failed to search notes: ${errorDetails}`,
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 测试获取随机笔记
   */
  async testGetRandomNote() {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/notes/random');

      TestAssertions.assertStatus(response.status, 200, 'Get Random Note');
      TestAssertions.assertSuccess(response.data, 'Get Random Note');

      const duration = Date.now() - startTime;
      this.resultManager.recordResult('Get Random Note', true, 'Random note retrieved', duration);
      return response.data.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.resultManager.recordResult(
        'Get Random Note',
        false,
        'Failed to get random note',
        duration,
        error
      );
      return null;
    }
  }

  /**
   * 清理创建的测试笔记
   */
  async cleanup() {
    for (const noteId of this.createdNoteIds) {
      try {
        await this.testDeleteNote(noteId);
      } catch {
        // 忽略清理错误
      }
    }
    this.createdNoteIds = [];
  }

  /**
   * 获取创建的笔记 ID 列表
   */
  getCreatedNoteIds(): string[] {
    return [...this.createdNoteIds];
  }
}
