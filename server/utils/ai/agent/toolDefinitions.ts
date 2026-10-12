import type { ChatToolDefinition } from '../client';
import type { LifecycleScope, TaskStatusScope } from '../retrievalPlan';
import { NATIVE_ROTE_SKILLS } from './skills';

export function createSkillViewToolDefinition(): ChatToolDefinition {
  return {
    type: 'function',
    function: {
      name: 'rote_skill_view',
      description: 'Load the workflow and safety notes for a built-in Rote AI skill.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: NATIVE_ROTE_SKILLS.map((skill) => skill.name),
          },
        },
        required: ['name'],
      },
    },
  };
}

export function createSearchNotesToolDefinition(params: {
  lifecycleScopes: LifecycleScope[];
  taskStatusScopes: TaskStatusScope[];
}): ChatToolDefinition {
  return {
    type: 'function',
    function: {
      name: 'rote_search_notes',
      description:
        'Search the current user Rote notes and articles with Rote-aware filters. Use this before answering questions that depend on memory.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Semantic evidence query. For broad analysis, write a broad useful query; leave empty only for pure hard-filter browsing.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          excludeTags: {
            type: 'array',
            items: { type: 'string' },
          },
          semanticScope: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Soft topic keywords for semantic retrieval. Use for themes and patterns that are not verified tags.',
          },
          selection: {
            type: 'string',
            enum: ['relevance', 'recent'],
            description:
              'Choose relevance for focused topic lookup. Choose recent for broad analysis of the latest records; recent ignores semantic query ranking.',
          },
          dateField: {
            type: 'string',
            enum: ['createdAt', 'updatedAt'],
            description:
              'Date basis for recent retrieval. Use createdAt for recently written records and updatedAt for recently modified/activity records.',
          },
          timeRange: {
            type: 'object',
            description:
              'Preferred structured time range. Use this instead of free-text from/to for dates.',
            properties: {
              type: {
                type: 'string',
                enum: ['absolute', 'rolling', 'relative_between', 'preset'],
              },
              preset: {
                type: 'string',
                enum: ['today', 'yesterday', 'this_month', 'last_month'],
              },
              fromDate: {
                type: 'string',
                description:
                  'For absolute ranges only. ISO date/datetime such as 2026-05-08 or 2026-05-08T00:00:00+08:00.',
              },
              toDate: {
                type: 'string',
                description:
                  'For absolute ranges only. ISO date/datetime such as 2026-05-09 or 2026-05-09T23:59:59+08:00.',
              },
              amount: { type: 'number', description: 'For rolling ranges, e.g. 7.' },
              unit: {
                type: 'string',
                enum: ['day', 'week', 'month', 'year'],
                description: 'For rolling ranges.',
              },
              fromRelative: {
                type: 'object',
                description: 'For relative_between ranges, e.g. 60 days ago.',
                properties: {
                  amount: { type: 'number' },
                  unit: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
                  direction: { type: 'string', enum: ['ago'] },
                },
              },
              toRelative: {
                type: 'object',
                description: 'For relative_between ranges, e.g. 30 days ago.',
                properties: {
                  amount: { type: 'number' },
                  unit: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
                  direction: { type: 'string', enum: ['ago'] },
                },
              },
              label: { type: 'string' },
            },
          },
          timeExpression: {
            type: 'string',
            description:
              'Relative range expression such as today, yesterday, last 7 days, or 最近7天.',
          },
          from: {
            type: 'string',
            description:
              'Absolute ISO date/datetime only, such as 2026-05-08 or 2026-05-08T00:00:00+08:00. Use timeExpression for relative ranges.',
          },
          to: {
            type: 'string',
            description:
              'Absolute ISO date/datetime only, such as 2026-05-09 or 2026-05-09T23:59:59+08:00. Use timeExpression for relative ranges.',
          },
          lifecycleScope: {
            type: 'string',
            enum: params.lifecycleScopes,
            description:
              'Note lifecycle scope only: active for unarchived notes, archived for archived notes, all for both, unspecified if not asked.',
          },
          taskStatusScope: {
            type: 'string',
            enum: params.taskStatusScopes,
            description:
              'Task/open-loop semantic scope only. This is independent from lifecycleScope and does not map to archived.',
          },
          sourceTypes: {
            type: 'array',
            items: { type: 'string', enum: ['rote', 'article'] },
          },
          limit: {
            type: 'number',
            description:
              'Maximum candidate count for this call; delivered excerpts depend on the shared text budget. Choose a larger value for broad pattern analysis and a smaller value for focused lookup.',
          },
        },
        required: ['query'],
      },
    },
  };
}

export const GET_NOTE_TOOL_DEFINITION: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'rote_get_note',
    description:
      'Read a bounded page of a Rote source. Continue with nextOffset when truncated; omitted offset continues automatically.',
    parameters: {
      type: 'object',
      properties: {
        sourceType: { type: 'string', enum: ['rote', 'article'] },
        sourceId: { type: 'string' },
        reason: { type: 'string' },
        offset: {
          type: 'integer',
          minimum: 0,
          description:
            'Unicode character offset. Use the previous nextOffset; omit to continue automatically.',
        },
      },
      required: ['sourceType', 'sourceId'],
    },
  },
};

export const FIND_RELATED_NOTES_TOOL_DEFINITION: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'rote_find_related_notes',
    description: 'Find related Rote notes for a source owned by the current user.',
    parameters: {
      type: 'object',
      properties: {
        sourceType: { type: 'string', enum: ['rote', 'article'] },
        sourceId: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['sourceType', 'sourceId'],
    },
  },
};

export const GET_TAGS_TOOL_DEFINITION: ChatToolDefinition = {
  type: 'function',
  function: {
    name: 'rote_get_tags',
    description: 'List the current user tags and counts.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },
};
