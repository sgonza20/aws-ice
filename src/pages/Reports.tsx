import { useEffect, useState } from "react";
import {
  Box,
  ContentLayout,
  Header,
  Table,
  StatusIndicator,
  Pagination,
  PieChart,
  SpaceBetween,
} from "@cloudscape-design/components";

interface Finding {
  instanceId: string;
  totalFailed: number;
  totalPassed: number;
}

const mockFindings: Finding[] = [
  { instanceId: "i-1234567890abcdef0", totalFailed: 5, totalPassed: 10 },
  { instanceId: "i-0abcdef1234567890", totalFailed: 2, totalPassed: 12 },
  // Add more mock data as needed
];

export default function Reports() {
  const [findings, setFindings] = useState<Finding[]>(mockFindings);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  // Mock fetching function
  useEffect(() => {
    // Fetch findings data from an API or other source here
    // setFindings(fetchedData);
  }, []);

  // Calculate totals
  const totalInstances = findings.length;
  const totalFailed = findings.reduce((sum, finding) => sum + finding.totalFailed, 0);
  const totalPassed = findings.reduce((sum, finding) => sum + finding.totalPassed, 0);

  // Data for the PieChart
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

  return (
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
        items={findings}
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
  );
}
