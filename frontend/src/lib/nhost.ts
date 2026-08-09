// nhost client initialization — connects to the cloud project

import { NhostClient } from '@nhost/react';

export const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
  region: process.env.NEXT_PUBLIC_NHOST_REGION || '',
});
