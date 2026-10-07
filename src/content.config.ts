import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { exerciseBaseSchema, pageSchema, programSchema, testSchema } from './content/schemas';

const exercises = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/exercises',
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
  }),
  schema: ({ image }) => exerciseBaseSchema.extend({ image: image() }),
});

const programs = defineCollection({
  loader: glob({
    pattern: '**/*.yaml',
    base: './src/content/programs',
    generateId: ({ entry }) => entry.replace(/\.ya?ml$/, ''),
  }),
  schema: programSchema,
});

const tests = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/tests' }),
  schema: ({ image }) => z.object({ tests: z.array(testSchema.extend({ image: image() })) }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: pageSchema,
});

export const collections = { exercises, programs, tests, pages };
