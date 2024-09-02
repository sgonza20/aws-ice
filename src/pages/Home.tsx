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
  totalLow: number;
  totalMedium: number;
  totalHigh: number;
  totalUnknown: number;
}

const client = generateClient<Schema>();

export default function Home() {
  const [instances, setInstances] = useState<Array<Schema["Instance"]["type"]>>([]);
  const [recentInstances, setRecentInstances] = useState<Array<Schema["Instance"]["type"]>>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const totalLow = findings.reduce((sum, finding) => sum + finding.totalLow, 0);
  const totalMedium = findings.reduce((sum, finding) => sum + finding.totalMedium, 0);
  const totalHigh = findings.reduce((sum, finding) => sum + finding.totalHigh, 0);
  const totalUnknown = findings.reduce((sum, finding) => sum + finding.totalUnknown, 0);


  const pieChartData = [
    {
      title: "Low Severity",
      value: totalLow,
      lastUpdate: new Date().toLocaleDateString(),
    },
    {
      title: "Medium Severity",
      value: totalMedium,
      lastUpdate: new Date().toLocaleDateString(),
    },
    {
      title: "High Severity",
      value: totalHigh,
      lastUpdate: new Date().toLocaleDateString(),
    },
    {
      title: "Unknown Severity",
      value: totalUnknown,
      lastUpdate: new Date().toLocaleDateString(),
    },
  ];

  async function getInstances() {
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
            CommandId: instance?.CommandId,
            PlatformName: instance?.PlatformName,
            PlatformType: instance?.PlatformType,
            LastScanTime: instance?.LastScanTime,
            ScanStatus: instance?.ScanStatus,
          });
        });
      }
      return data;
    } catch (error) {
      console.error("Error fetching instances:", error);
      return [];
    }
  }

    async function syncInstances() {
    try {
      const fetchedInstances = await getInstances();
      if (!fetchedInstances) {
        console.error("Error fetching instances:", "No instances found");
        return;
      }
      const instanceIds = fetchedInstances.map((instance) => instance?.InstanceId);
      
      const { data, errors } = await client.models.Instance.list();

      if (errors) {
        console.error("Error fetching local instances:", errors);
        return;
      }

      const existingInstances = data.filter(instance => instanceIds.includes(instance.InstanceId));
      
      setInstances(existingInstances);

      const newInstances = fetchedInstances.filter(instance => !existingInstances.some(existing => existing.InstanceId === instance?.InstanceId));

      for (const instance of newInstances) {
        await client.models.Instance.create({
          InstanceId: instance?.InstanceId!,
          CommandId: instance?.CommandId,
          PlatformName: instance?.PlatformName,
          PlatformType: instance?.PlatformType,
          LastScanTime: instance?.LastScanTime,
          ScanStatus: instance?.ScanStatus,
        });
      }
    } catch (error) {
      console.error("Error syncing instances:", error);
    } finally {
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
        const { InstanceId, TotalLowSeverity, TotalMediumSeverity, TotalHighSeverity, TotalUnknown } = finding;
  
        if (!findingsAggregated[InstanceId]) {
          findingsAggregated[InstanceId] = {
            instanceId: InstanceId,
            totalLow: 0,
            totalMedium: 0,
            totalHigh: 0,
            totalUnknown: 0,
          };
        }
  
        findingsAggregated[InstanceId].totalLow += TotalLowSeverity || 0;
        findingsAggregated[InstanceId].totalMedium += TotalMediumSeverity || 0;
        findingsAggregated[InstanceId].totalHigh += TotalHighSeverity || 0;
        findingsAggregated[InstanceId].totalUnknown += TotalUnknown || 0;
      });
  
      setFindings(Object.values(findingsAggregated));
    } catch (error) {
      console.error("Error fetching findings:", error);
    }
  }

  function isWithinLast24Hours(date: string | undefined): boolean {
    if (!date) return false;
    const now = new Date();
    const scanDate = new Date(date);
    const timeDifference = now.getTime() - scanDate.getTime();
    return timeDifference <= 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  async function getRecentScans() {
    try {
      const { data, errors } = await client.models.Instance.list();
  
      if (errors) {
        console.error("Error fetching instances:", errors);
        return [];
      }
  
      const recentInstances = data.filter((instance) =>
        isWithinLast24Hours(instance?.LastScanTime!)
      );
  
      setRecentInstances(recentInstances);
    } catch (error) {
      console.error("Error fetching recent scans:", error);
      return [];
    }
  }
  

  // Update scans periodically
  useEffect(() => {
    getRecentScans();
    syncInstances();
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
        {/* <Box textAlign="center">
          <img src="https://github.com/sgonza20/aws-ice/blob/main/src/components/Images/openscap-horizontal.png" alt="OpenSCAP Logo" style={{ width: "400px" }} />
        </Box> */}
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
                      items={recentInstances}
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
