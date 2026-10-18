<script lang="ts">
  import raw from '#lib/report.json';
  import type { Report } from '#lib/schema';
  import ReportPage from '#lib/components/ReportPage.svelte';
  const injected = JSON.parse(document.getElementById('report-data')?.textContent ?? 'null') as Report | null;
</script>

<ReportPage report={injected ?? (raw as unknown as Report)} />
