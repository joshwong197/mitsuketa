import type { PersonCompanyResult } from '../types';
import { removedCompany } from './relationshipStatus';

/** Active here means a current role in a company still on the register. */
export const isActivePersonCompany = (result: Pick<PersonCompanyResult, 'entityStatusCode' | 'isInactive' | 'status'>): boolean =>
  !result.isInactive && (result.entityStatusCode ?? 0) < 80 && !removedCompany(result);
