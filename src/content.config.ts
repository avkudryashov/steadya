import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { exerciseBaseSchema, pageSchema, programSchema, testSchema } from './content/schemas';

const exercises = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/exercises' }),
  schema: ({ image }) => exerciseBaseSchema.extend({ image: image() }),
});

const programs = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/programs' }),
  schema: programSchema,
});

const tests = defineCollection({
  loader: file('./src/content/tests.yaml'),
  schema: testSchema,
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: pageSchema,
});

export const collections = { exercises, programs, tests, pages };
