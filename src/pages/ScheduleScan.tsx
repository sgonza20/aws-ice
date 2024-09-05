import { useEffect, useState } from "react";
import {
  Box,
  Button,
  ContentLayout,
  Header,
  Table,
  SpaceBetween,
  Pagination,
  Modal,
  Spinner,
  StatusIndicator,
  Form,
  Icon,
  FormField,
  Select,
} from "@cloudscape-design/components";
import TextFilter from "@cloudscape-design/components/text-filter";
import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

interface Option {
  label: string;
  value: string;
}

export default function ScheduleScan() {
  const [instances, setInstances] = useState<Array<Schema["Instance"]["type"]>>(
    []
  );
  const [selectedInstances, setSelectedInstances] = useState<
    Array<Schema["Instance"]["type"]>
  >([]);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isRunModalVisible, setIsRunModalVisible] = useState(false);
  const [selectedOS, setSelectedOS] = useState<Option | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<Option | null>(
    null
  );
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filteringText, setFilteringText] = useState("");
  const itemsPerPage = 10;

  async function getInstances() {
    setIsLoading(true);
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
            InstanceName: instance?.InstanceName,
            RoleName: instance?.RoleName,
            LastScanRunCommandId: instance?.LastScanRunCommandId,
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
    } finally {
      setIsLoading(false);
    }
  }

  async function syncInstances() {
    setIsLoading(true);
    try {
      const fetchedInstances = await getInstances();
      if (!fetchedInstances) {
        console.error("Error fetching instances:", "No instances found");
        return;
      }
      const instanceIds = fetchedInstances.map(
        (instance) => instance?.InstanceId
      );

      const { data, errors } = await client.models.Instance.list();

      if (errors) {
        console.error("Error fetching local instances:", errors);
        return;
      }

      const existingInstances = data.filter((instance) =>
        instanceIds.includes(instance.InstanceId)
      );

      setInstances(existingInstances);

      const newInstances = fetchedInstances.filter(
        (instance) =>
          !existingInstances.some(
            (existing) => existing.InstanceId === instance?.InstanceId
          )
      );

      for (const instance of newInstances) {
        await client.models.Instance.create({
          InstanceId: instance?.InstanceId!,
          InstanceName: instance?.InstanceName,
          RoleName: instance?.RoleName,
          LastScanRunCommandId: instance?.LastScanRunCommandId,
          PlatformName: instance?.PlatformName,
          PlatformType: instance?.PlatformType,
          LastScanTime: instance?.LastScanTime,
          ScanStatus: instance?.ScanStatus,
        });
      }
    } catch (error) {
      console.error("Error syncing instances:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteInstance(InstanceID: string) {
    client.models.Instance.delete({ InstanceId: InstanceID });
    syncInstances();
  }

  async function InvokeScan(
    InstanceID: string,
    OS: string,
    Benchmark: string,
    RoleName: string
  ) {
    try {
      const { data, errors } = await client.queries.InvokeSSM({
        InstanceId: InstanceID,
        RoleName: RoleName,
        OS: OS,
        Benchmark: Benchmark,
      });
      console.log(data, errors);

      if (errors) {
        console.error("Error invoking SSM:", errors);
        return;
      }

      if (data?.statusCode === 200) {
        if (typeof data.body === "string") {
          const commandId = data.body;
          await client.models.Instance.update({
            InstanceId: InstanceID,
            LastScanTime: new Date().toISOString(),
            LastScanRunCommandId: commandId,
            ScanStatus: "InProgress",
          });
        }
      }
      syncInstances();
    } catch (error) {
      console.error("Error in InvokeScan:", error);
    }
  }

  function confirmScan() {
    if (selectedOS && selectedBenchmark) {
      selectedInstances.forEach((item) => {
        if (typeof item.RoleName === "string") {
          InvokeScan(
            item.InstanceId,
            selectedOS.value,
            selectedBenchmark.value,
            item.RoleName
          );
        } else {
          console.error("RoleName is not a string:", item.RoleName);
        }
      });
      console.log(selectedInstances);
      setSelectedInstances([]);
      setIsRunModalVisible(false);
    } else {
      alert("Please select both OS and Benchmark.");
    }
  }

  function confirmDelete() {
    setIsDeleteModalVisible(false);
    selectedInstances.forEach((item) => deleteInstance(item.InstanceId));
  }

  const isOption = (option: any): option is Option =>
    typeof option.label === "string" && typeof option.value === "string";

  const filteredInstances = instances.filter((instance) =>
    instance.InstanceName!.toLowerCase().includes(filteringText.toLowerCase())
  );

  const paginatedInstances = filteredInstances.slice(
    (currentPageIndex - 1) * itemsPerPage,
    currentPageIndex * itemsPerPage
  );

  useEffect(() => {
    syncInstances();
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
      <Header
        variant="h1"
        actions={
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={syncInstances} ariaLabel="Refresh Instances">
              {isLoading ? <Spinner /> : <Icon name="refresh" />}
              {!isLoading}
            </Button>
            <Button
              onClick={() =>
                selectedInstances.length > 0 && setIsDeleteModalVisible(true)
              }
              disabled={selectedInstances.length === 0}
            >
              Delete
            </Button>
            <Button
              onClick={() =>
                selectedInstances.length > 0 && setIsRunModalVisible(true)
              }
              disabled={selectedInstances.length === 0}
            >
              Run Scan
            </Button>
          </SpaceBetween>
        }
      >
        Instances ({instances.length})
      </Header>
      <FormField label="Search by Instance Name">
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
            id: "instanceName",
            header: "Instance Name",
            cell: (item) => item.InstanceName,
            isRowHeader: true,
          },
          {
            id: "platformName",
            header: "Platform Name",
            cell: (item) => item.PlatformName || undefined,
          },
          {
            id: "lastScanTime",
            header: "Last Scan Inititation",
            cell: (item) =>
              item.LastScanTime
                ? new Date(item.LastScanTime).toLocaleString()
                : "N/A",
          },
          {
            id: "LastScanRunCommandId",
            header: "Last Scan Run Command ID",
            cell: (item) => item.LastScanRunCommandId || undefined,
          },
          {
            id: "scanStatus",
            header: "Scan Status",
            cell: (item) => (
              <StatusIndicator
                type={
                  item.ScanStatus === "Success"
                    ? "success"
                    : item.ScanStatus === "Failed"
                    ? "error"
                    : "info"
                }
              >
                {item.ScanStatus || "N/A"}
              </StatusIndicator>
            ),
          },
        ]}
        items={paginatedInstances}
        selectedItems={selectedInstances}
        onSelectionChange={({ detail }) =>
          setSelectedInstances(detail.selectedItems)
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            onChange={({ detail }) =>
              setCurrentPageIndex(detail.currentPageIndex)
            }
            pagesCount={Math.ceil(filteredInstances.length / 10)}
          />
        }
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No EC2 Instances</b>
            </SpaceBetween>
          </Box>
        }
        selectionType="multi"
        variant="full-page"
        stickyHeader={true}
        resizableColumns={true}
        loadingText="Loading instances"
      />
      <Modal
        onDismiss={() => setIsDeleteModalVisible(false)}
        visible={isDeleteModalVisible}
        closeAriaLabel="Close"
        header="Confirm Deletion"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setIsDeleteModalVisible(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmDelete}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Are you sure you want to delete the selected instances? This action
        cannot be undone.
      </Modal>
      <Modal
        onDismiss={() => setIsRunModalVisible(false)}
        visible={isRunModalVisible}
        closeAriaLabel="Close"
        header="Run OpenSCAP Scan"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setIsRunModalVisible(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmScan}>
                Run
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Box padding="l">
          <Form>
            <FormField label="Select OS">
              <Select
                selectedOption={selectedOS}
                onChange={({ detail }) => {
                  if (isOption(detail.selectedOption)) {
                    setSelectedOS(detail.selectedOption);
                  }
                }}
                options={[
                  { label: "Amazon Linux 2", value: "ssg-amzn2-ds.xml" },
                  {
                    label: "Red Hat Enterprise Linux 7",
                    value: "ssg-rhel7-ds.xml",
                  },
                ]}
              />
            </FormField>
            <FormField label="Select Benchmark">
              <Select
                selectedOption={selectedBenchmark}
                onChange={({ detail }) => {
                  if (isOption(detail.selectedOption)) {
                    setSelectedBenchmark(detail.selectedOption);
                  }
                }}
                options={[
                  {
                    label: "DISA STIG",
                    value:
                      "xccdf_org.ssgproject.content_profile_stig-rhel7-disa",
                  },
                  {
                    label: "C2S",
                    value: "xccdf_org.ssgproject.content_profile_C2S",
                  },
                  {
                    label: "CSCF RHEL6 MLS Core Baseline",
                    value:
                      "xccdf_org.ssgproject.content_profile_CSCF-RHEL6-MLS",
                  },
                  {
                    label: "PCI-DSS v3 Control Baseline",
                    value: "xccdf_org.ssgproject.content_profile_pci-dss",
                  },
                  {
                    label: "Standard System Security",
                    value: "xccdf_org.ssgproject.content_profile_standard",
                  },
                  {
                    label:
                      "United States Government Configuration Baseline (USGCB)",
                    value:
                      "xccdf_org.ssgproject.content_profile_usgcb-rhel6-server",
                  },
                  {
                    label: "Server Baseline",
                    value: "xccdf_org.ssgproject.content_profile_server",
                  },
                  {
                    label:
                      "Red Hat Corporate Profile for Certified Cloud Providers (RH CCP)",
                    value: "xccdf_org.ssgproject.content_profile_rht-ccp",
                  },
                  {
                    label: "CNSSI 1253 Low/Low/Low Control Baseline",
                    value: "xccdf_org.ssgproject.content_profile_nist-CL-IL-AL",
                  },
                  {
                    label: "FTP Server Profile (vsftpd)",
                    value: "xccdf_org.ssgproject.content_profile_ftp-server",
                  },
                  {
                    label: "FISMA Medium",
                    value:
                      "xccdf_org.ssgproject.content_profile_fisma-medium-rhel6-server",
                  },
                  {
                    label: "Desktop Baseline",
                    value: "xccdf_org.ssgproject.content_profile_desktop",
                  },
                ]}
              />
            </FormField>
          </Form>
        </Box>
      </Modal>
    </ContentLayout>
  );
}
