import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const trackEnum = z.enum(['bible', 'church-history', 'world-context']);
const precisionEnum = z.enum(['exact', 'circa', 'range', 'disputed']);

const epochs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/de/epochs' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    track: trackEnum,
    level: z.union([z.literal(1), z.literal(2)]).default(1),
    parentEpoch: z.string().nullable().default(null),
    order: z.number(),
    date: z.object({
      start: z.number(),
      end: z.number(),
      precision: precisionEnum.default('circa'),
      display: z.string(),
    }),
    style: z.object({
      color: z.string(),
      scaleWeight: z.number().default(1.0),
    }),
    media: z
      .object({
        coverImage: z.string().nullable().default(null),
        videoUrl: z.string().nullable().default(null),
      })
      .optional(),
    summary: z.string(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/de/events' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    category: z
      .enum(['event', 'person', 'writing', 'council', 'ruler', 'movement'])
      .default('event'),
    track: trackEnum,
    minZoomLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    epoch: z.string(),
    date: z.object({
      start: z.number(),
      end: z.number(),
      precision: precisionEnum.default('exact'),
      display: z.string(),
      alternatives: z
        .array(
          z.object({
            label: z.string(),
            start: z.number(),
            end: z.number(),
            source: z.string(),
          })
        )
        .default([]),
    }),
    location: z
      .object({
        name: z.string(),
        region: z.string().optional(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
      })
      .optional(),
    media: z
      .object({
        thumbnail: z.string().nullable().default(null),
        gallery: z.array(z.string()).default([]),
        videoUrl: z.string().nullable().default(null),
      })
      .optional(),
    scriptureRefs: z.array(z.string()).default([]),
    sources: z
      .array(
        z.object({
          title: z.string(),
          author: z.string().optional(),
          type: z.enum(['primary', 'secondary']).default('secondary'),
          url: z.string().optional(),
        })
      )
      .default([]),
    relatedEvents: z
      .array(
        z.object({
          id: z.string(),
          relation: z
            .enum(['cause', 'effect', 'prophecy-fulfillment', 'continuation', 'parallel'])
            .default('continuation'),
          note: z.string().optional(),
        })
      )
      .default([]),
    tags: z.array(z.string()).default([]),
    summary: z.string(),
  }),
});

export const collections = { epochs, events };
