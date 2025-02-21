import * as workflow from '@temporalio/workflow';
import type * as activities from '../activities/delivery-partner.activities';

const { executeTestRule } = workflow.proxyActivities<typeof activities>({
    startToCloseTimeout: '1 minute',
});

export async function deliveryPartnerWorkflow(partnerId: string): Promise<string> {
    const result = await executeTestRule(partnerId);
    return result;
} 