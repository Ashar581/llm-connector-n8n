import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

export class ScraperAgent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Scraper Agent',
		name: 'scraperAgent',
		icon: {
			light: 'file:scraper.svg',
			dark: 'file:scraper.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{ ($parameter["url"] && $parameter["url"].parameters && $parameter["url"].parameters[0] && $parameter["url"].parameters[0].value) || "https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/web/scrape" }}',
		description: 'Scrape a URL through your web scraping service',
		defaults: {
			name: 'Scraper Agent',
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
		requestDefaults: {
			baseURL: 'https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/web/scrape',
			method: 'GET',
			url: '',
			headers: {
				Accept: 'application/json',
			},
		},
		properties: [
			{
				displayName: 'API Endpoint',
				name: 'apiEndpointNotice',
				type: 'notice',
				default: 'API: https://transparent-suzann-limy.ngrok-free.dev/api/llm/v1/web/scrape | Target: https://example.com',
				description: 'Base API endpoint. The target URL is set below as a query parameter. Example: https://example.com',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					fixedCollection: {
						itemTitle: '={{ $collection.item.value.name }}',
					},
				},
				required: true,
				default: {
					parameters: [
						{
							name: 'url',
							value: '',
						},
					],
				},
				description: 'The URL to scrape',
				options: [
					{
						name: 'parameters',
						displayName: 'URL',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: 'url',
								description: 'The query parameter name',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'https://example.com',
								description: 'The URL to scrape',
								routing: {
									send: {
										property: 'url',
										type: 'query',
									},
								},
							},
						],
					},
				],
			},
			{
				displayName: 'Response Format',
				name: 'response',
				type: 'options',
				options: [
					{
						name: 'Markdown',
						value: 'markdown',
					},
					{
						name: 'HTML',
						value: 'html',
					},
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				default: 'markdown',
				description: 'The format in which the scraped content is returned',
				routing: {
					request: {
						qs: {
							response: '={{ $value }}',
						},
					},
				},
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
							minValue: 1000,
							maxValue: 3600000,
							numberPrecision: 0,
						},
						default: 300000,
						description: 'The maximum time to wait for the request to complete, in milliseconds',
						routing: {
							request: {
								timeout: '={{ $value }}' as unknown as number,
							},
						},
					},
				],
			},
		],
	};
}