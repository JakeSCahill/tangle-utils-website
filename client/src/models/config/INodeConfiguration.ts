/**
 * Definition of node configuration file.
 */
export interface INodeConfiguration {
    /**
     * The provider to use for IOTA communication.
     */
    provider: string;

    /**
     * Depth for attaches.
     */
    depth: number;

    /**
     * Minimum weight magnitude for attaches.
     */
    mwm: number;
}
