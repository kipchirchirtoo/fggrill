import { logger } from './logger';

interface QueryPerformanceMetrics {
    queryType: string;
    duration: number;
    success: boolean;
    error?: string;
}

class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private queryMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    startTimer(queryType: string): { end: (success: boolean, error?: string) => void } {
        const startTime = process.hrtime.bigint();
        
        return {
            end: (success: boolean, error?: string) => {
                const endTime = process.hrtime.bigint();
                const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
                
                this.recordMetric({
                    queryType,
                    duration,
                    success,
                    error
                });

                // Log slow queries
                if (duration > 1000) {
                    logger.warn(`Slow query detected: ${queryType}`, {
                        duration: `${duration}ms`,
                        success,
                        error
                    });
                }
            }
        };
    }

    private recordMetric(metric: QueryPerformanceMetrics): void {
        if (!this.queryMetrics.has(metric.queryType)) {
            this.queryMetrics.set(metric.queryType, []);
        }

        const metrics = this.queryMetrics.get(metric.queryType)!;
        metrics.push(metric);

        // Keep only last 100 metrics per query type
        if (metrics.length > 100) {
            metrics.shift();
        }
    }

    getMetrics(queryType: string): QueryPerformanceMetrics[] {
        return this.queryMetrics.get(queryType) || [];
    }

    getAllMetrics(): Map<string, QueryPerformanceMetrics[]> {
        return this.queryMetrics;
    }

    getAverageTime(queryType: string): number {
        const metrics = this.getMetrics(queryType);
        if (metrics.length === 0) return 0;
        
        const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
        return total / metrics.length;
    }
}

export const performanceMonitor = PerformanceMonitor.getInstance();