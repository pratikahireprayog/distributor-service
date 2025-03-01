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
                // Ensure the function is properly bound to its original context
                const boundFn = fn as (...args: any[]) => Promise<any>;

                // Register with capitalized first letter (original behavior)
                activities[`${key}${method.charAt(0).toUpperCase() + method.slice(1)}`] = boundFn;

                // Also register with the exact original method name for case-sensitive matching
                activities[`${key}${method}`] = boundFn;
            });
        });
        this.logger.log(`Registered activities: ${Object.keys(activities).join(', ')}`);
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
        this.logger.log(`Registering activities for ${name}: ${Object.keys(activityMethods).join(', ')}`);
        // Ensure all methods are properly bound
        const boundMethods = Object.entries(activityMethods).reduce((acc, [key, fn]) => {
            acc[key] = fn as (...args: any[]) => Promise<any>;
            return acc;
        }, {} as Record<string, (...args: any[]) => Promise<any>>);

        this.registeredActivities.set(name, boundMethods);
    }
}