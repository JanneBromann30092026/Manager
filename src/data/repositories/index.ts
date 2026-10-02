import {
  ideaInputSchema,
  planInputSchema,
  postInputSchema,
  reportInputSchema,
  videoInputSchema,
} from '../schemas';
import { createRecordRepo } from './recordsRepo';

export { brandRepo, defaultBrand, selectBrand } from './brandRepo';
export { filesRepo, FileTooLargeError } from './filesRepo';
export { metaRepo, VaultExistsError } from './metaRepo';
export { settingsRepo } from './settingsRepo';

export const videosRepo = createRecordRepo('videos', videoInputSchema);
export const ideasRepo = createRecordRepo('ideas', ideaInputSchema);
export const postsRepo = createRecordRepo('posts', postInputSchema);
export const reportsRepo = createRecordRepo('reports', reportInputSchema);
export const plansRepo = createRecordRepo('plans', planInputSchema);
export { SECRET_KEYS, secretsRepo, type SecretKey } from './secretsRepo';
