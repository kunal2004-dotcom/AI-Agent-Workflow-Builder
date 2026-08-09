// Hasura Action handler: createOrganization
// POST /v1/functions/create-organization
//
// Atomically creates an organization AND inserts the caller as owner in org_members.
// This is an Action rather than a direct insert to ensure atomicity.

import type { Request, Response } from 'express';
import { hasuraAdmin } from './_utils/hasura';
import { HasuraActionPayload } from './_utils/types';

interface CreateOrgInput {
  name: string;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const payload = req.body as HasuraActionPayload<CreateOrgInput>;
    const userId = payload.session_variables?.['x-hasura-user-id'];
    const { name } = payload.input;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: 'Organization name must be at least 2 characters' });
    }

    // Create org + insert creator as owner atomically
    const createOrgData = await hasuraAdmin<any>(`
      mutation CreateOrgWithOwner($name: String!, $user_id: uuid!) {
        insert_organizations_one(object: {
          name: $name
          quota_limit: 100
          quota_used: 0
          org_members: {
            data: [{
              user_id: $user_id
              role: "owner"
            }]
          }
        }) {
          id
          name
        }
      }
    `, { name: name.trim(), user_id: userId });

    const org = createOrgData?.insert_organizations_one;

    if (!org) {
      throw new Error('Failed to create organization');
    }

    return res.status(200).json({
      org_id: org.id,
      name: org.name,
    });
  } catch (err: any) {
    console.error('[create-organization] Error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}
