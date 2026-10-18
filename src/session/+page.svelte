<script lang="ts">
  import ReportPage from '#lib/components/ReportPage.svelte';
  let { data } = $props();
</script>

<ReportPage report={data.report} session />
