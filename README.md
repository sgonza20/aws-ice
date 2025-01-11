## aws-ice

## Overview

AWS ICE, or AWS Intance Compliance Evaluation, is an AWS Amplify Application that is meant to ease the process of evaluating AWS EC2 Instances for complinace purposes. With AWS ICE, you are able to see all EC2 Instances in an account, run compliance scans, evaluate security findings from the generated report, and download the generated reports, all in one location.

## Purpose

Running compliance scans on EC2 instances can take up a lot of effort. If your environment doesn't utilize any automation, this can mean manually logging into each instance using SSH. This can pose serious security threats or human error. AWS ICE sets up all of the required resources to automate this process and simplify efforts.

![Architecture diagram](aws-ice-diagram.drawio.svg)

## License

This library is licensed under the MIT-0 License. See the LICENSE file.