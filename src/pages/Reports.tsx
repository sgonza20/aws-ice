import { useEffect, useState } from "react";
import {
  ContentLayout,
  Header,
  Table,
  Pagination,
} from "@cloudscape-design/components";
import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

interface Finding {
  instanceId: string;
  totalFailed: number;
  totalPassed: number;
}

const client = generateClient<Schema>();

export default function Reports() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
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

      // Aggregate findings per instance
      const findingsAggregated: Record<string, Finding> = {};

      data.forEach((finding) => {
        const InstanceId = finding.InstanceId as string;
        const Result = finding.Result as string;

        if (!findingsAggregated[InstanceId]) {
          findingsAggregated[InstanceId] = {
            instanceId: InstanceId,
            totalFailed: 0,
            totalPassed: 0,
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

  const paginatedFindings = findings.slice(
    (currentPageIndex - 1) * itemsPerPage,
    currentPageIndex * itemsPerPage
  );

  return (
    <ContentLayout>
      <Header>Reports</Header>
      <Table
        columnDefinitions={[
          { id: "instanceId", header: "Instance ID", cell: (item) => item.instanceId },
          { id: "totalPassed", header: "Total Passed", cell: (item) => item.totalPassed },
          { id: "totalFailed", header: "Total Failed", cell: (item) => item.totalFailed },
        ]}
        items={paginatedFindings}
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            onChange={handlePaginationChange}
            pagesCount={Math.ceil(findings.length / itemsPerPage)}
          />
        }
      />
    </ContentLayout>
  );
}
