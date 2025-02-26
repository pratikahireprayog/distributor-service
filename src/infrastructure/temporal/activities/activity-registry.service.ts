import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for registering and retrieving Temporal activities
 */
@Injectable()
export class ActivityRegistryService {
    private readonly logger = new Logger(ActivityRegistryService.name);
    private registeredActivities: Map<string, Record<string, (...args: any[]) => Promise<any>>> = new Map();

    constructor() { }

    /**
     * Gets all registered activities as a flat object
     * @returns All registered activities
     */
    getActivities() {
        const activities = {};
        this.registeredActivities.forEach((activityMethods, key) => {
            Object.entries(activityMethods).forEach(([method, fn]) => {
                activities[`${key}${method.charAt(0).toUpperCase() + method.slice(1)}`] = fn;
            });
        });
        return activities;
    }

    /**
     * Registers activity methods for a given name
     * @param name The activity name
     * @param activityMethods The activity methods
     */
    register(
        name: string,
        activityMethods: Record<string, (...args: any[]) => Promise<any>>
    ) {
        this.logger.log(`Registering activities for ${name}`);
        const boundMethods = {};

        // Bind methods to maintain 'this' context
        Object.entries(activityMethods).forEach(([method, fn]) => {
            boundMethods[method] = fn.bind(activityMethods);
        });

        this.registeredActivities.set(name, boundMethods);
    }
} 