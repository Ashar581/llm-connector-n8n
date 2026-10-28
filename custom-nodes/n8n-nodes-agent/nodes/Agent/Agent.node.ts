// Agent Node for POST to https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/agent
// Handles multipart/form-data with query, agent, chatHistoryEnabled, chatHistoryForForm
// and binary files support.

import FormData from 'form-data';

import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type IExecuteFunctions,
	type INodeExecutionData,
	type IDataObject,
	type IHttpRequestOptions,
	type EngineResponse,
} from 'n8n-workflow';

export class Agent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agent',
		name: 'agent',
		icon: {
			light: 'file:assets/agent.svg',
			dark: 'file:assets/agent.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["query"] || $parameter["agent"] || "Agent" }}',
		description: 'Send data to the Agent API via POST with form-data payload',
		defaults: {
			name: 'Agent',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'httpBearerAuth',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'API Endpoint',
				name: 'apiEndpointNotice',
				type: 'notice',
				default: 'Endpoint: https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/agent',
				description: 'This is the base URL used for the agent request. Form data is sent as multipart/form-data.',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				description: 'The query text to send to the agent',
				default: '',
				required: true,
			},
			{
				displayName: 'Agent ID',
				name: 'agent',
				type: 'string',
				description: 'Agent identifier (defaults to "agent_180826074235238")',
				default: 'agent_180826074235238',
			},
			{
				displayName: 'Chat History Enabled',
				name: 'chatHistoryEnabled',
				type: 'boolean',
				default: false,
				description: 'Enable chat history tracking',
			},
			{
				displayName: 'Chat History (Form)',
				name: 'chatHistoryForForm',
				type: 'string',
				description: 'JSON array of chat history items (ignored if chatHistoryEnabled is false)',
				default: '',
				noDataExpression: true,
			},
			{
				displayName: 'Files',
				name: 'files',
				type: 'collection',
				placeholder: 'Add File',
				description: 'Files to upload as part of the form-data payload',
				default: {},
				options: [
					{
						displayName: 'File',
						name: 'file',
						type: 'fixedCollection',
						default: {
							binary: [
								{},
							],
						},
						typeOptions: {
							multipleValues: true,
						},
						options: [
							{
								displayName: 'Binary Data',
								name: 'binary',
								values: [
									{
										displayName: 'Input Data Field Name',
										name: 'inputDataFieldName',
										type: 'string',
										default: '',
										description: 'The name of the incoming field containing the binary file data',
									},
									{
										displayName: 'Form Data Field Name',
										name: 'formDataFieldName',
										type: 'string',
										default: 'files',
										description: 'The form-data field name. The backend expects the key "files" with multiple entries forming an array.',
									},
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 300000,
						},
						default: 30000,
						description: 'Request timeout in milliseconds',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions, response?: EngineResponse): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];
		const debugInfo: string[] = [];

		for (let i = 0; i < items.length; i++) {
			// Read each parameter directly by name. The 'parameters' collection
			// name is not a real parameter in this node, so getNodeParameter
			// returns the fallback {} and no form fields are appended.
			const query = this.getNodeParameter('query', i, '') as string;
			const agent = this.getNodeParameter('agent', i, 'agent_180826074235238') as string;
			const chatHistoryEnabled = this.getNodeParameter('chatHistoryEnabled', i, false) as boolean;
			const chatHistoryForForm = this.getNodeParameter('chatHistoryForForm', i, '') as string;

			// Build multipart/form-data payload as a FormData instance.
			// The new OutboundHttp transport only inspects the `body` property,
			// so a FormData instance is passed as `body` directly.
			const formData = new FormData();

			// Add query
			if (query) {
				formData.append('query', query);
			}

			// Add agent
			if (agent) {
				formData.append('agent', agent);
			}

			// Add chat history enabled
			if (chatHistoryEnabled) {
				formData.append('chatHistoryEnabled', 'true');
			}

			// Add chat history form data
			if (chatHistoryForForm) {
				try {
					const history = JSON.parse(chatHistoryForForm);
					formData.append('chatHistoryForForm', JSON.stringify(history));
				} catch {
					// If invalid JSON, pass as string
					formData.append('chatHistoryForForm', chatHistoryForForm);
				}
			}

			// Add files as binary data using HTTP Request node pattern.
			// A fixedCollection stores its value keyed by option name, e.g.
			// { file: { binary: [...] } } — iterate the option values, not a
			// dotted path that may not exist.
			const rawFiles = this.getNodeParameter('files', i, {}) as IDataObject;
			const filesOptions = Object.values(rawFiles) as IDataObject[];
			debugInfo.push(`RAW files=${JSON.stringify(rawFiles)}`);
			debugInfo.push(`filesOptions.length=${filesOptions?.length ?? 0}`);
			if (filesOptions && filesOptions.length > 0) {
				for (let fi = 0; fi < filesOptions.length; fi++) {
					const fileOption = filesOptions[fi];
					if (!fileOption) continue;
					const binaryConfig = fileOption.binary as IDataObject[];
					if (binaryConfig && binaryConfig.length > 0) {
						for (let bi = 0; bi < binaryConfig.length; bi++) {
							const bin = binaryConfig[bi];
							if (!bin) continue;
							const inputDataFieldName = bin.inputDataFieldName as string;
							const formDataFieldName = (bin.formDataFieldName as string) || 'files';
		
							if (inputDataFieldName) {
								try {
									const binaryDataItem = this.helpers.assertBinaryData(i, inputDataFieldName);
									const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, inputDataFieldName);
													formData.append(formDataFieldName, binaryDataBuffer, {
										filename: binaryDataItem.fileName || 'file',
										contentType: binaryDataItem.mimeType,
										knownLength: binaryDataBuffer.length,
									});
								} catch (e) {
												}
							}
						}
					}
				}
			}
			debugInfo.push(`formData.getLengthSync()=${formData.getLengthSync()}`);

			// Prepare request options - FormData instance as body for multipart/form-data
			const options: IHttpRequestOptions = {
				method: 'POST',
				url: '',
				baseURL: 'https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/agent',
				body: formData,
			};

			const optionsTimeout = this.getNodeParameter('options.timeout', i, 30000) as number;
			if (optionsTimeout) {
				options.timeout = optionsTimeout;
			}

			// Execute request
			try {
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'httpBearerAuth',
					options,
				);

				// The Agent API returns the full response body (e.g.
				// { code, data, message, status }). Return it directly so the
				// node output mirrors the API payload instead of wrapping it.
				const result: INodeExecutionData = response !== undefined && response !== null
					? { json: response }
					: { json: { status: 'success' } };
				returnItems.push(result);
			} catch (error) {
				const err = error as Error & {
					statusCode?: number;
					response?: { data?: unknown; status?: number; headers?: unknown };
					cause?: Error;
					code?: string;
					isAxiosError?: boolean;
					config?: unknown;
				 };

				// Extract real error details - handle AxiosError structure
				const statusCode = err.statusCode || err.response?.status || 500;
				let message = err.message || 'Unknown error';

				// For AxiosError, response.data contains the actual backend response
				if (err.response?.data) {
					message = JSON.stringify(err.response.data);
				} else if (err.cause?.message) {
					message = err.cause.message;
				} else if (err.code) {
					message = `${err.code}: ${err.message}`;
				}

				// Also include the full error object for debugging
				const config = err.config as Record<string, unknown> | undefined;
				returnItems.push({
					json: {
						status: 'error',
						error: {
							message,
							statusCode,
							debug: {
								name: err.name,
								code: err.code,
								isAxiosError: err.isAxiosError,
								cause: err.cause?.message,
								responseData: err.response?.data,
								responseStatus: err.response?.status,
								responseHeaders: err.response?.headers,
								requestUrl: config?.url || config?.baseURL,
								requestMethod: config?.method,
							},
						},
						},
				});
			}
		}

		return [returnItems];
	}
}

exports.Agent = Agent;
