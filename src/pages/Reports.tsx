import { useEffect, useState } from "react";
import {
  Box,
  ContentLayout,
  Header,
  Table,
  StatusIndicator,
  Pagination,
  PieChart,
  SplitPanel,
  AppLayout,
  Checkbox,
  Button
} from "@cloudscape-design/components";

interface Finding {
  instanceId: string;
  totalFailed: number;
  totalPassed: number;
}

interface DetailedFinding {
  instanceId: string;
  findings: {
    ruleName: string;
    status: "Failed" | "Passed";
    description: string;
  }[];
}

const mockFindings: Finding[] = [
  { instanceId: "i-1234567890abcdef0", totalFailed: 5, totalPassed: 10 },
  { instanceId: "i-0abcdef1234567890", totalFailed: 2, totalPassed: 12 },
  // Add more mock data as needed
];

const mockDetailedFindings: DetailedFinding[] = [
  {
    instanceId: "i-1234567890abcdef0",
    findings: [
      { ruleName: "Rule 1", status: "Failed", description: "Description of rule 1" },
      { ruleName: "Rule 2", status: "Passed", description: "Description of rule 2" },
      // Add more mock data as needed
    ]
  },
  {
    instanceId: "i-0abcdef1234567890",
    findings: [
      { ruleName: "Rule 3", status: "Failed", description: "Description of rule 3" },
      { ruleName: "Rule 4", status: "Passed", description: "Description of rule 4" },
      // Add more mock data as needed
    ]
  }
];

export default function Reports() {
  const [findings] = useState<Finding[]>(mockFindings);
  const [detailedFindings, setDetailedFindings] = useState<DetailedFinding[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  useEffect(() => {
    // Fetch findings data from an API or other source here
    // setFindings(fetchedData);
  }, []);

  const handleCheckboxChange = (instanceId: string, checked: boolean) => {
    const newSelectedInstances = new Set(selectedInstances);
    if (checked) {
      newSelectedInstances.add(instanceId);
    } else {
      newSelectedInstances.delete(instanceId);
    }
    setSelectedInstances(newSelectedInstances);

    if (checked) {
      const details = mockDetailedFindings.find(df => df.instanceId === instanceId);
      if (details) {
        setDetailedFindings([details]);
        setSelectedInstanceId(instanceId);
      }
    } else {
      if (selectedInstanceId === instanceId) {
        setSelectedInstanceId(null);
        setDetailedFindings([]);
      }
    }
  };

  const handleCloseSplitPanel = () => {
    setSelectedInstanceId(null);
    setDetailedFindings([]);
  };

  const totalFailed = findings.reduce((sum, finding) => sum + finding.totalFailed, 0);
  const totalPassed = findings.reduce((sum, finding) => sum + finding.totalPassed, 0);

  const pieChartData = [
    {
      title: "Failed Findings",
      value: totalFailed,
      lastUpdate: new Date().toLocaleDateString()
    },
    {
      title: "Passed Findings",
      value: totalPassed,
      lastUpdate: new Date().toLocaleDateString()
    }
  ];

  const tableRows = findings.map(finding => ({
    instanceId: finding.instanceId,
    totalFailed: finding.totalFailed,
    totalPassed: finding.totalPassed,
    isChecked: selectedInstances.has(finding.instanceId)
  }));

  return (
    <AppLayout
    
      splitPanel={
        selectedInstanceId ? (
          <SplitPanel header={`Details for ${selectedInstanceId}`}>
            <Box padding="m">
              <Table
                columnDefinitions={[
                  {
                    id: "ruleName",
                    header: "Rule Name",
                    cell: (item) => item.ruleName,
                  },
                  {
                    id: "status",
                    header: "Status",
                    cell: (item) => (
                      <StatusIndicator type={item.status === "Failed" ? "error" : "success"}>
                        {item.status}
                      </StatusIndicator>
                    ),
                  },
                  {
                    id: "description",
                    header: "Description",
                    cell: (item) => item.description,
                  },
                ]}
                items={detailedFindings.flatMap(df => df.findings)}
                variant="full-page"
                stickyHeader={true}
                resizableColumns={true}
              />
              <Box margin={{ top: "m" }}>
                <Button onClick={handleCloseSplitPanel}>Close</Button>
              </Box>
            </Box>
          </SplitPanel>
        ) : undefined
      }
      content={
        <ContentLayout>
          <Header variant="h1">Reports</Header>
          <Box margin={{ bottom: "l" }}>
            <Header variant="h2">Findings Overview</Header>
            <PieChart
              data={pieChartData}
              detailPopoverContent={(datum, sum) => [
                { key: "Count", value: datum.value },
                {
                  key: "Percentage",
                  value: `${((datum.value / sum) * 100).toFixed(0)}%`
                },
                { key: "Last update on", value: datum.lastUpdate }
              ]}
              segmentDescription={(datum, sum) =>
                `${datum.value} findings, ${((datum.value / sum) * 100).toFixed(0)}%`
              }
              ariaDescription="Pie chart showing the distribution of failed and passed findings."
              ariaLabel="Pie chart"
              empty={
                <Box textAlign="center" color="inherit">
                  <b>No data available</b>
                  <Box variant="p" color="inherit">
                    There is no data available
                  </Box>
                </Box>
              }
              noMatch={
                <Box textAlign="center" color="inherit">
                  <b>No matching data</b>
                  <Box variant="p" color="inherit">
                    There is no matching data to display
                  </Box>
                </Box>
              }
            />
          </Box>
          <Table
            columnDefinitions={[
              {
                id: "select",
                header: "",
                cell: (item: Finding) => (
                  <Checkbox
                    checked={selectedInstances.has(item.instanceId)}
                    onChange={(e) => handleCheckboxChange(item.instanceId, e.detail.checked)}
                  />
                ),
                width: 60,
              },
              {
                id: "instanceId",
                header: "Instance ID",
                cell: (item: Finding) => item.instanceId,
                isRowHeader: true,
              },
              {
                id: "totalFailed",
                header: "Failed Findings",
                cell: (item: Finding) => (
                  <StatusIndicator type={item.totalFailed > 0 ? "error" : "success"}>
                    {item.totalFailed}
                  </StatusIndicator>
                ),
              },
              {
                id: "totalPassed",
                header: "Passed Findings",
                cell: (item: Finding) => (
                  <StatusIndicator type={item.totalPassed > 0 ? "success" : "error"}>
                    {item.totalPassed}
                  </StatusIndicator>
                ),
              },
            ]}
            items={tableRows}
            pagination={
              <Pagination
                currentPageIndex={currentPageIndex}
                onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
                pagesCount={Math.ceil(findings.length / 10)}
              />
            }
            empty={
              <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
                <b>No Findings Available</b>
              </Box>
            }
            variant="full-page"
            stickyHeader={true}
            resizableColumns={true}
            loadingText="Loading findings"
          />
        </ContentLayout>
      }
    />
  );
}
