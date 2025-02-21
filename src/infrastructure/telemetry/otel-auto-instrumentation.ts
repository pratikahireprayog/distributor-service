import {
  OTEL_ENV_CONST,
  OTEL_PORT_CONST,
  OTEL_CONFIG_CONST,
} from 'src/infrastructure/telemetry/telemetry.constant';
import { Meter, metrics } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import * as SemResAttrs from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
// import { registerInstrumentations } from '@opentelemetry/instrumentation';
// import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';

// For debugging otel
// import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

export class AutoInstrumentation {
  private sdk: NodeSDK;
  private traceExporter;
  private meterProvider;
  private meter: Meter;
  private requestCounter: any;

  constructor(serviceName: string, serviceVersion = '') {
    console.log('Initializing Opentelemetry auto instrumentation.');
    const resource = Resource.default().merge(
      new Resource({
        [SemResAttrs.SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SemResAttrs.SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      }),
    );

    this.setTraceExporter();
    this.setMetricExporter(resource);

    this.sdk = new NodeSDK({
      resource: resource,
      traceExporter: this.traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });
  }

  setTraceExporter() {
    console.log('Initializing OTLPTraceExporter.');
    const OTLP_TRACE_EXPORTER_URL = this.getOtelTraceExporterURL();
    this.traceExporter = new OTLPTraceExporter({
      url: OTLP_TRACE_EXPORTER_URL,
    });
  }

  setMetricExporter(resource: Resource) {
    console.log('Initializing OTLPMetricExporter.');
    const OTLP_METRIC_EXPORTER_URL = this.getOtelMetricExporterURL();

    this.meterProvider = new MeterProvider({
      resource: resource,
    });

    const metricReader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: OTLP_METRIC_EXPORTER_URL,
      }),

      // Default is 60000ms (60 seconds) but set with 30 sec.
      exportIntervalMillis: OTEL_CONFIG_CONST.EXPORT_INTERVAL_MILLIS,
    });

    this.meterProvider.addMetricReader(metricReader);

    // Set this MeterProvider to be global to the app being instrumented.
    metrics.setGlobalMeterProvider(this.meterProvider);
  }

  initializeRequestCounter() {
    this.meter = metrics.getMeter('http_request_meter');
    this.requestCounter = this.meter.createCounter('http_requests', {
      description: 'Counts the number of HTTP requests',
    });
  }

  incrementRequestCount(route: string) {
    this.requestCounter.add(1, { route });
  }

  getOtelTraceExporterURL() {
    return (
      process.env[OTEL_ENV_CONST.OTEL_BASE_URL] +
      ':' +
      (process.env[OTEL_ENV_CONST.OTEL_TRACE_EXPORTER_PORT] ??
        OTEL_PORT_CONST.OTEL_TRACE_EXPORTER_PORT) +
      process.env[OTEL_ENV_CONST.OTEL_TRACE_EXPORTER_END_POINT]
    );
  }

  getOtelMetricExporterURL() {
    return (
      process.env[OTEL_ENV_CONST.OTEL_BASE_URL] +
      ':' +
      (process.env[OTEL_ENV_CONST.OTEL_METRIC_EXPORTER_PORT] ??
        OTEL_PORT_CONST.OTEL_METRIC_EXPORTER_PORT) +
      process.env[OTEL_ENV_CONST.OTEL_METRIC_EXPORTER_END_POINT]
    );
  }

  start() {
    console.log('Starting opentelemetry auto instrumentation.');
    this.sdk.start();
  }

  shutdown() {
    // Opentelemetry shutdown method to gracefully shut down the SDK before process shutdown
    // or on some operating system signal.
    this.sdk
      .shutdown()
      .then(
        () => console.log('Opentelemetry SDK shut down successfully'),
        (err) => console.log('Error shutting down Opentelemetry SDK', err),
      )
      .finally(() => process.exit(0));
  }
}

// new WinstonInstrumentation({
//   logHook: (span, record) => {
//     record['traceId'] = span.spanContext().traceId;
//     record['spanId'] = span.spanContext().spanId;
//   },
// }),
