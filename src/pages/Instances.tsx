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
  Select
} from "@cloudscape-design/components";
import { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

interface Option {
  label: string;
  value: string;
}

export default function EC2Instances() {
  const [instances, setInstances] = useState<Array<Schema["Instance"]["type"]>>([]);
  const [selectedInstances, setSelectedInstances] = useState<Array<Schema["Instance"]["type"]>>([]);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isRunModalVisible, setIsRunModalVisible] = useState(false);
  const [selectedOS, setSelectedOS] = useState<Option | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<Option | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchInstances();
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

  async function fetchInstances() {
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
            CommandId: instance?.CommandId,
            PlatformName: instance?.PlatformName,
            PlatformType: instance?.PlatformType,
            LastScanTime: instance?.LastScanTime,
            ScanStatus: instance?.ScanStatus,
          });
        });
      }
    } catch (error) {
      console.error("Error fetching instances:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteInstance(InstanceID: string){

    client.models.Instance.delete({InstanceId: InstanceID});
  
  }

  async function InvokeScan(InstanceID: string, DocumentName: string, OS: string, Benchmark: string) {
    const { data, errors } = await client.queries.InvokeSSM({
      InstanceId: InstanceID,
      DocumentName: DocumentName,
      OS: OS,
      Benchmark: Benchmark
    });
    console.log(data, errors);

    if (data?.statusCode === 200) {
      if (typeof data.body === 'string'){
        const commandId = data.body;
        await client.models.Instance.update({
          InstanceId: InstanceID,
          LastScanTime: new Date().toISOString(),
          CommandId: commandId,
          ScanStatus: 'InProgress',
        });
      }
    }
  }

  function confirmScan() {
    if (selectedOS && selectedBenchmark) {
      selectedInstances.forEach((item) =>
        InvokeScan(item.InstanceId,"AWSICESCAPAGAIN122", selectedOS.value, selectedBenchmark.value)
      );
      console.log(selectedInstances);
      setSelectedInstances([]);
      setIsRunModalVisible(false);
    } else {
      // Handle case where OS or Benchmark is not selected
      alert('Please select both OS and Benchmark.');
    }
  }

  function confirmDelete() {
    setIsDeleteModalVisible(false);
    selectedInstances.forEach((item) =>
    deleteInstance(item.InstanceId)
    );
  }

  const isOption = (option: any): option is Option => 
    typeof option.label === 'string' && typeof option.value === 'string';

  return (
    <ContentLayout>
      <Header
        variant="h1"
        actions={
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={fetchInstances}
              ariaLabel="Refresh Instances"
            >
              {isLoading ? (
                <Spinner />
              ) : (
                <Icon name="refresh" />
              )}
              {!isLoading}
            </Button>
            <Button
              onClick={() => selectedInstances.length > 0 && setIsDeleteModalVisible(true)}
              disabled={selectedInstances.length === 0}
            >
              Delete
            </Button>
            <Button
              onClick={() => setIsRunModalVisible(true)}
            >
              Run Scan
            </Button>
          </SpaceBetween>
        }
      >
        Instances ({instances.length})
      </Header>
      <Table
        columnDefinitions={[
          {
            id: "instanceId",
            header: "Instance ID",
            cell: (item) => item.InstanceId,
            isRowHeader: true,
          },
          {
            id: "platformName",
            header: "Platform Name",
            cell: (item) => item.PlatformName || undefined,
          },
          {
            id: "lastScanTime",
            header: "Last Scan Time",
            cell: (item) => item.LastScanTime ? new Date(item.LastScanTime).toLocaleString() : 'N/A',
          },
          {
            id: "CommandId",
            header: "Run Command ID",
            cell: (item) => item.CommandId || undefined,
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
        selectedItems={selectedInstances}
        onSelectionChange={({ detail }) => setSelectedInstances(detail.selectedItems)}
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
            pagesCount={Math.ceil(instances.length / 10)}
          />
        }
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No EC2 Instances</b>
              <Button onClick={() => {}}>Create Instance</Button>
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
              <Button variant="link" onClick={() => setIsDeleteModalVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmDelete}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        Are you sure you want to delete the selected instances? This action cannot be undone.
      </Modal>
      <Modal
        onDismiss={() => setIsRunModalVisible(false)}
        visible={isRunModalVisible}
        closeAriaLabel="Close"
        header="Run OpenSCAP Scan"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setIsRunModalVisible(false)}>
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
                  { label: "Red Hat Enterprise Linux 7", value: "ssg-rhel7-ds.xml" },
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
                { label: "DISA STIG", value: "xccdf_org.ssgproject.content_profile_stig-rhel7-disa" },
                { label: "C2S", value: "xccdf_org.ssgproject.content_profile_C2S" },
                { label: "CSCF RHEL6 MLS Core Baseline", value: "xccdf_org.ssgproject.content_profile_CSCF-RHEL6-MLS" },
                { label: "PCI-DSS v3 Control Baseline", value: "xccdf_org.ssgproject.content_profile_pci-dss" },
                { label: "Standard System Security", value: "xccdf_org.ssgproject.content_profile_standard" },
                { label: "United States Government Configuration Baseline (USGCB)", value: "xccdf_org.ssgproject.content_profile_usgcb-rhel6-server" },
                { label: "Server Baseline", value: "xccdf_org.ssgproject.content_profile_server" },
                { label: "Red Hat Corporate Profile for Certified Cloud Providers (RH CCP)", value: "xccdf_org.ssgproject.content_profile_rht-ccp" },
                { label: "CNSSI 1253 Low/Low/Low Control Baseline", value: "xccdf_org.ssgproject.content_profile_nist-CL-IL-AL" },
                { label: "FTP Server Profile (vsftpd)", value: "xccdf_org.ssgproject.content_profile_ftp-server" },
                { label: "FISMA Medium", value: "xccdf_org.ssgproject.content_profile_fisma-medium-rhel6-server" },
                { label: "Desktop Baseline", value: "xccdf_org.ssgproject.content_profile_desktop" },
              ]}
            />
            </FormField>
          </Form>
        </Box>
      </Modal>
    </ContentLayout>
  );
}
