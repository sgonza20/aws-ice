import { useState, useEffect } from "react";
import {
  ContentLayout,
  Header,
  Box,
  SpaceBetween,
  Container,
  Button,
  StatusIndicator,
  Table,
  PieChart,
} from "@cloudscape-design/components";
import Board from "@cloudscape-design/board-components/board";
import BoardItem from "@cloudscape-design/board-components/board-item";
import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

interface Finding {
  instanceId: string;
  totalFailed: number;
  totalPassed: number;
}

const client = generateClient<Schema>();

export default function Home() {
  const [instances, setInstances] = useState<Array<Schema["Instance"]["type"]>>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const totalFailed = findings.reduce((sum, finding) => sum + finding.totalFailed, 0);
  const totalPassed = findings.reduce((sum, finding) => sum + finding.totalPassed, 0);

  const pieChartData = [
    {
      title: "Passed Findings",
      value: totalPassed,
      lastUpdate: new Date().toLocaleDateString(),
    },
    {
      title: "Failed Findings",
      value: totalFailed,
      lastUpdate: new Date().toLocaleDateString(),
    },
  ];

  async function fetchInstances() {
    try {
      const { data, errors } = await client.queries.GetInstances();

      console.log("Instances found:", data);

      if (errors) {
        console.error("Error fetching instances:", errors);
        return;
      }

      if (data) {
        data.forEach(async (instance) => {
          await client.models.Instance.create({
            InstanceId: instance?.InstanceId!,
            LastScanTime: instance?.LastScanTime,
            ScanStatus: instance?.ScanStatus,
          });
        });
      }
    } catch (error) {
      console.error("Error fetching instances:", error);
    }
  }
  

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
        const { InstanceId, Result } = finding;
  
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
  

  // Update scans periodically
  useEffect(() => {
    fetchInstances();
    fetchFindings();
    const subscription = client.models.Instance.observeQuery().subscribe({
      next: (data) => {
        setInstances(data.items);
      },
      error: (error) => console.error("Subscription error:", error),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ContentLayout>
      <SpaceBetween size="l">
        <Box textAlign="center">
          <img src="./src/components/Images/openscap-horizontal.png" alt="OpenSCAP Logo" style={{ width: "400px" }} />
        </Box>
        <Container>
          <Header variant="h2">Overview</Header>
          <p>Welcome to AWS - Instance Compliance Evaluation.</p>
        </Container>
        <Container>
          <Header variant="h2">Features</Header>
          <ul>
            <li>Automated OpenSCAP scans on EC2 instances</li>
            <li>Generate comprehensive compliance reports</li>
            <li>Identify and remediate security vulnerabilities</li>
            <li>Ensure compliance with industry standards</li>
          </ul>
        </Container>
        <Container>
          <Board
            items={[
              {
                id: "1",
                rowSpan: 5,
                columnSpan: 4,
                data: {
                  title: "Findings",
                  content: (
                    <PieChart
                      data={pieChartData}
                      detailPopoverContent={(datum, sum) => [
                        { key: "Count", value: datum.value },
                        {
                          key: "Percentage",
                          value: `${((datum.value / sum) * 100).toFixed(0)}%`,
                        },
                        { key: "Last update on", value: datum.lastUpdate },
                      ]}
                      segmentDescription={(datum, sum) =>
                        `${datum.value} total, ${((datum.value / sum) * 100).toFixed(0)}%`
                      }
                      ariaDescription="Donut chart showing generic example data."
                      ariaLabel="Donut chart"
                      size="large"
                      variant="donut"
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
                          <Button>Clear filter</Button>
                        </Box>
                      }
                    />
                  ),
                },
              },
              {
                id: "2",
                rowSpan: 3,
                columnSpan: 4,
                data: {
                  title: "Recent Scans (24h)",
                  content: (
                    <Table
                      columnDefinitions={[
                        {
                          id: "instanceId",
                          header: "Instance ID",
                          cell: (item) => item.InstanceId,
                          isRowHeader: true,
                        },
                        {
                          id: "lastScanTime",
                          header: "Last Scan Time",
                          cell: (item) => item.LastScanTime ? new Date(item.LastScanTime).toLocaleString() : 'N/A',
                        },
                        {
                          id: "scanStatus",
                          header: "Scan Status",
                          cell: (item) => (
                            <StatusIndicator type={item.ScanStatus === 'Success' ? 'success' : item.ScanStatus === 'Failed' ? 'error' : 'info'}>
                              {item.ScanStatus || 'N/A'}
                            </StatusIndicator>
                          ),
                        },
                      ]}
                      items={instances}
                    />
                  ),
                },
              },
              {
                id: "3",
                rowSpan: 3,
                columnSpan: 4,
                data: {
                  title: "Scheduled Scans",
                  content: (
                    <Table
                      columnDefinitions={[
                        {
                          id: "instanceId",
                          header: "Instance ID",
                          cell: (item) => item.InstanceId,
                          isRowHeader: true,
                        },
                        {
                          id: "lastScanTime",
                          header: "Scan Time",
                          cell: (item) => item.LastScanTime ? new Date(item.LastScanTime).toLocaleString() : 'N/A',
                        },
                        {
                          id: "scanStatus",
                          header: "Scan Status",
                          cell: (item) => (
                            <StatusIndicator type={item.ScanStatus === 'Success' ? 'success' : item.ScanStatus === 'Failed' ? 'error' : 'info'}>
                              {item.ScanStatus || 'N/A'}
                            </StatusIndicator>
                          ),
                        },
                      ]}
                      items={instances}
                    />
                  ),
                },
              },
              {
                id: "4",
                rowSpan: 3,
                columnSpan: 4,
                data: {
                  title: "Uncompliant Scans",
                  content: (
                    <Table
                      columnDefinitions={[
                        {
                          id: "instanceId",
                          header: "Instance ID",
                          cell: (item) => item.InstanceId,
                          isRowHeader: true,
                        },
                        {
                          id: "lastScanTime",
                          header: "Scan Time",
                          cell: (item) => item.LastScanTime ? new Date(item.LastScanTime).toLocaleString() : 'N/A',
                        },
                        {
                          id: "scanStatus",
                          header: "Scan Status",
                          cell: (item) => (
                            <StatusIndicator type={item.ScanStatus === 'Success' ? 'success' : item.ScanStatus === 'Failed' ? 'error' : 'info'}>
                              {item.ScanStatus || 'N/A'}
                            </StatusIndicator>
                          ),
                        },
                      ]}
                      items={instances}
                    />
                  ),
                },
              },
            ]}
            renderItem={(item) => (
              <BoardItem
                header={<Header>{item.data.title}</Header>}
                i18nStrings={{
                  dragHandleAriaLabel: "Drag handle",
                  dragHandleAriaDescription:
                    "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
                  resizeHandleAriaLabel: "Resize handle",
                  resizeHandleAriaDescription:
                    "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.",
                }}
              >
                {item.data.content}
              </BoardItem>
            )}
            i18nStrings={{
              liveAnnouncementDndStarted: (operationType) =>
                operationType === "resize" ? "Resizing" : "Dragging",
              liveAnnouncementDndItemReordered: (operation) => {
                const columns = `column ${operation.placement.x + 1}`;
                const rows = `row ${operation.placement.y + 1}`;
                return `Item moved to ${
                  operation.direction === "horizontal" ? columns : rows
                }.`;
              },
              liveAnnouncementDndItemResized: (operation) => {
                const columnsConstraint = operation.isMinimalColumnsReached
                  ? " (minimal)"
                  : "";
                const rowsConstraint = operation.isMinimalRowsReached
                  ? " (minimal)"
                  : "";
                const sizeAnnouncement =
                  operation.direction === "horizontal"
                    ? `columns ${operation.placement.width}${columnsConstraint}`
                    : `rows ${operation.placement.height}${rowsConstraint}`;
                return `Item resized to ${sizeAnnouncement}.`;
              },
              liveAnnouncementDndItemInserted: (operation) => {
                const columns = `column ${operation.placement.x + 1}`;
                const rows = `row ${operation.placement.y + 1}`;
                return `Item inserted to ${columns}, ${rows}.`;
              },
              liveAnnouncementDndCommitted: (operationType) =>
                `${operationType} committed`,
              liveAnnouncementDndDiscarded: (operationType) =>
                `${operationType} discarded`,
              liveAnnouncementItemRemoved: (op) =>
                `Removed item ${op.item.data.title}.`,
              navigationAriaLabel: "Board navigation",
              navigationAriaDescription:
                "Click on non-empty item to move focus over",
              navigationItemAriaLabel: (item) =>
                item ? item.data.title : "Empty",
            }}
            empty={
              <Box textAlign="center" color="inherit">
                <b>No items available</b>
                <Box variant="p" color="inherit">
                  There are no items to display on the board.
                </Box>
              </Box>
            }
            onItemsChange={() => {}}
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
