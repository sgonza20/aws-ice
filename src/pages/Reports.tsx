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
  Button
} from "@cloudscape-design/components";
import TextFilter from "@cloudscape-design/components/text-filter";
import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

interface Finding {
  instanceId: string;
  totalFailed: number;
  totalPassed: number;
  Report_url: string;
}

const client = generateClient<Schema>();

export default function Reports() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [filteringText, setFilteringText] = useState('');
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

      const findingsAggregated: Record<string, Finding> = {};

      data.forEach((finding) => {
        const InstanceId = finding.InstanceId as string;
        const Result = finding.Result as string;
        const Report_url = finding.Report_url as string;

        if (!findingsAggregated[InstanceId]) {
          findingsAggregated[InstanceId] = {
            instanceId: InstanceId,
            totalFailed: 0,
            totalPassed: 0,
            Report_url: Report_url
          };
        }

        if (Result === "fail") {
          findingsAggregated[InstanceId].totalFailed += 1;
        } else if (Result === "pass") {
          findingsAggregated[InstanceId].totalPassed += 1;
        }
      });

      setFindings(Object.values(findingsAggregated));
    } catch (error) {
      console.error("Error fetching findings:", error);
    }
  }

  useEffect(() => {
    fetchFindings();
  }, []);

  const handlePaginationChange = ({ detail }: { detail: { currentPageIndex: number } }) => {
    setCurrentPageIndex(detail.currentPageIndex);
  };

  const filteredFindings = findings.filter(finding =>
    finding.instanceId.toLowerCase().includes(filteringText.toLowerCase())
  );

  const paginatedFindings = filteredFindings.slice(
    (currentPageIndex - 1) * itemsPerPage,
    currentPageIndex * itemsPerPage
  );

  return (
    <ContentLayout>
      <Header
        variant="h1"
        actions={
          <SpaceBetween size="xs" direction="horizontal">
          </SpaceBetween>
        }
      >
        Findings
      </Header>
      <FormField label="Search by Instance ID">
        <TextFilter
          filteringText={filteringText}
          filteringPlaceholder="Find instances"
          filteringAriaLabel="Filter instances"
          onChange={({ detail }) => setFilteringText(detail.filteringText)}
        />
      </FormField>
      <Table
        columnDefinitions={[
          { 
            id: "instanceId",
            header: "Instance ID", 
            cell: (item) => item.instanceId,
            isRowHeader: true,
          },
          { 
            id: "totalPassed", 
            header: "Total Passed", 
            cell: (item) => (
              <StatusIndicator 
                type="success">{item.totalPassed}
              </StatusIndicator>
            ),
          },
          { 
            id: "totalFailed", 
            header: "Total Failed", 
            cell: (item) => (
              <StatusIndicator 
                type="error">{item.totalFailed}
              </StatusIndicator>
            ),
          },
          { 
            id: "reportUrl",
            header: "View Report",
            cell: (item) => (
              <Button
                href={item.Report_url}
                target="_blank"
                variant="link"
              >
                View
              </Button>
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
