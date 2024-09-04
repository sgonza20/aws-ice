import { useEffect, useState } from "react";
import {
  ContentLayout,
  Box,
  Header,
  Table,
  Pagination,
  StatusIndicator,
  SpaceBetween,
  FormField,
  Button,
  Select
} from "@cloudscape-design/components";
import TextFilter from "@cloudscape-design/components/text-filter";
import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

interface Finding {
  instanceId: string;
  totalFailed: number;
  totalPassed: number;
  Report_url: string;
  Benchmark: string;
}

const benchmarks = [
  { label: "-", },
  { label: "DISA STIG", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_stig-rhel7-disa" },
  { label: "C2S", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_C2S" },
  { label: "CSCF RHEL6 MLS Core Baseline", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_CSCF-RHEL6-MLS" },
  { label: "PCI-DSS v3 Control Baseline", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_pci-dss" },
  { label: "Standard System Security", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_standard" },
  { label: "United States Government Configuration Baseline (USGCB)", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_usgcb-rhel6-server" },
  { label: "Server Baseline", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_server" },
  { label: "Red Hat Corporate Profile for Certified Cloud Providers (RH CCP)", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_rht-ccp" },
  { label: "CNSSI 1253 Low/Low/Low Control Baseline", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_nist-CL-IL-AL" },
  { label: "FTP Server Profile (vsftpd)", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_ftp-server" },
  { label: "FISMA Medium", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_fisma-medium-rhel6-server" },
  { label: "Desktop Baseline", value: "xccdf_org.open-scap_testresult_xccdf_org.ssgproject.content_profile_desktop" },
];

const client = generateClient<Schema>();

export default function Reports() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [filteringText, setFilteringText] = useState('');
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('');
  const itemsPerPage = 10;

  async function fetchFindings() {
    try {
      const { data, errors } = await client.models.Finding.list({
        limit: 1000,
      });
  
      if (errors) {
        console.error("Error fetching findings:", errors);
        return;
      }
  
      const instanceNameMap = await fetchInstanceNames();
      const findingsAggregated: Record<string, Finding> = {};
  
      data.forEach((finding) => {
        const InstanceId = finding.InstanceId as string;
        const TotalFailed = finding.TotalFailed as number;
        const TotalPassed = finding.TotalPassed as number;
        const Report_url = finding.Report_url as string;
        const Benchmark = finding.Benchmark as string;
  
        if (!findingsAggregated[InstanceId]) {
          findingsAggregated[InstanceId] = {
            instanceId: instanceNameMap[InstanceId] || InstanceId,
            totalFailed: TotalFailed,
            totalPassed: TotalPassed,
            Report_url: Report_url,
            Benchmark: Benchmark,
          };
        }
      });
  
      setFindings(Object.values(findingsAggregated));
    } catch (error) {
      console.error("Error fetching findings:", error);
    }
  }
  
  async function fetchInstanceNames() {
    try {
      const { data, errors } = await client.models.Instance.list({
        limit: 1000,
      });
  
      if (errors) {
        console.error("Error fetching instance names:", errors);
        return {};
      }
  
      const instanceNameMap: Record<string, string> = {};
      data.forEach((instance) => {
        const name = instance.InstanceName;
        if (name) {
          instanceNameMap[instance.InstanceId] = name;
        }
      });
  
      return instanceNameMap;
    } catch (error) {
      console.error("Error fetching instance names:", error);
      return {};
    }
  }

  useEffect(() => {
    fetchFindings();
  }, []);

  const handlePaginationChange = ({ detail }: { detail: { currentPageIndex: number } }) => {
    setCurrentPageIndex(detail.currentPageIndex);
  };

  const filteredFindings = findings
    .filter(finding =>
      finding.instanceId.toLowerCase().includes(filteringText.toLowerCase()) &&
      (!selectedBenchmark || finding.Benchmark === selectedBenchmark)
    );

  const paginatedFindings = filteredFindings.slice(
    (currentPageIndex - 1) * itemsPerPage,
    currentPageIndex * itemsPerPage
  );

  return (
    <ContentLayout>
      <Header
        variant="h1"
        actions={<SpaceBetween size="xs" direction="horizontal"></SpaceBetween>}
      >
        Findings
      </Header>
      <SpaceBetween size="m">
        <FormField label="Search by Instance Name">
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Find instances"
            filteringAriaLabel="Filter instances"
            onChange={({ detail }) => setFilteringText(detail.filteringText)}
          />
        </FormField>
        <FormField label="Filter by Benchmark">
          <Select
            selectedOption={
              benchmarks.find((b) => b.value === selectedBenchmark) ?? null
            }
            onChange={({ detail }) =>
              setSelectedBenchmark(detail.selectedOption?.value || "")
            }
            options={benchmarks}
            placeholder="Select a benchmark"
          />
        </FormField>
      </SpaceBetween>
      <Table
        columnDefinitions={[
          {
            id: "instanceId",
            header: "Instance Name",
            cell: (item) => item.instanceId,
            isRowHeader: true,
          },
          {
            id: "benchmark",
            header: "Benchmark",
            cell: (item) => {
              const benchmark = benchmarks.find(
                (b) => b.value === item.Benchmark
              );
              return benchmark ? benchmark.label : item.Benchmark;
            },
          },
          {
            id: "totalPassed",
            header: "Total Passed",
            cell: (item) => (
              <StatusIndicator type="success">
                {item.totalPassed}
              </StatusIndicator>
            ),
          },
          {
            id: "totalFailed",
            header: "Total Failed",
            cell: (item) => (
              <StatusIndicator type="error">{item.totalFailed}</StatusIndicator>
            ),
          },
          {
            id: "reportUrl",
            header: "Report Actions",
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  href={item.Report_url}
                  target="_blank"
                  variant="inline-link"
                  iconName="file"
                >
                  View
                </Button>
                <Button
                  href={item.Report_url}
                  download
                  variant="inline-link"
                  iconName="download"
                >
                  Download
                </Button>
              </SpaceBetween>
            ),
          },
        ]}
        items={paginatedFindings}
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            onChange={handlePaginationChange}
            pagesCount={Math.ceil(filteredFindings.length / itemsPerPage)}
          />
        }
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No Findings</b>
            </SpaceBetween>
          </Box>
        }
        variant="full-page"
        stickyHeader={true}
        loadingText="Loading findings..."
      />
    </ContentLayout>
  );
}
