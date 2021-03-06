import { addChecksum } from "@iota/checksum";
import { isHash, isTag, isTrytesOfExactLength } from "@iota/validators";
import { Button, ClipboardHelper, Form, FormStatus, Heading } from "iota-react-components";
import React, { Component, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ServiceFactory } from "../../factories/serviceFactory";
import { UnitsHelper } from "../../helpers/unitsHelper";
import { HashType } from "../../models/hashType";
import { NetworkType } from "../../models/services/networkType";
import { TangleCacheService } from "../../services/tangleCacheService";
import BundleObject from "../components/BundleObject";
import TransactionObject from "../components/TransactionObject";
import "./ExploreView.scss";
import { ExploreViewProps } from "./ExploreViewProps";
import { ExploreViewState } from "./ExploreViewState";

/**
 * Component which will explore the tangle.
 */
class ExploreView extends Component<ExploreViewProps, ExploreViewState> {
    /**
     * The tangle cache service.
     */
    private readonly _tangleCacheService: TangleCacheService;

    /**
     * Is the component mounted.
     */
    private _mounted: boolean;

    /**
     * Create a new instance of ExploreView.
     * @param props The props.
     */
    constructor(props: ExploreViewProps) {
        super(props);

        this._tangleCacheService = ServiceFactory.get<TangleCacheService>("tangle-cache");
        this._mounted = false;

        let paramHash = "";
        let paramHashChecksum = "";
        let paramHashType: HashType = "transaction";
        let paramNetwork: NetworkType = "mainnet";

        if (this.props.match && this.props.match.params) {
            if (this.props.match.params.hash &&
                this.props.match.params.hash.length > 0 &&
                this.props.hashType &&
                this.props.hashType.length > 0) {
                paramHash = this.props.match.params.hash;
                paramHashType = this.props.hashType;
                if (paramHashType === "address") {
                    paramHashChecksum = addChecksum(paramHash).substr(-9);
                }
            }
            if (this.props.match.params.network === "mainnet" ||
                this.props.match.params.network === "devnet") {
                paramNetwork = this.props.match.params.network;
            }
        }

        this.state = {
            hash: paramHash,
            checksum: paramHashChecksum,
            hashType: paramHashType,
            isValid: false,
            validMessage: "",
            isBusy: false,
            status: "",
            isErrored: false,
            network: paramNetwork,
            balance: 0
        };
    }

    /**
     * The component mounted.
     */
    public async componentDidMount(): Promise<void> {
        this._mounted = true;

        if (this.state.hash && this.state.hash.length > 0) {
            const isValid = this.validate();
            if (isValid) {
                await this.loadData();
            }
        } else {
            this.props.history.replace("/");
        }
    }

    /**
     * The component will unmount from the dom.
     */
    public async componentWillUnmount(): Promise<void> {
        this._mounted = false;
    }

    /**
     * Render the component.
     * @returns The node to render.
     */
    public render(): ReactNode {
        const network = this.state.network === "mainnet" ? "" : `/${this.state.network}`;

        return (
            <div className="explore">
                {!this.state.transactionTrytes && !this.state.transactionHashes && (
                    <Form>
                        <FormStatus message={this.state.status} isBusy={this.state.isBusy} isError={this.state.isErrored} />
                    </Form>
                )}
                {this.state.transactionTrytes && (
                    <React.Fragment>
                        <Heading level={1}>Transaction</Heading>
                        <TransactionObject hash={this.state.hash} trytes={this.state.transactionTrytes} network={this.state.network} />
                    </React.Fragment>
                )}
                {this.state.transactionHashes && (this.state.hashType === "tag" || this.state.hashType === "address") && (
                    <div className="list">
                        <Heading level={1}>{this.state.hashType === "tag" ? "Tag" : "Address"}</Heading>
                        <div className="row">
                            <div className="hash">
                                {this.state.hash}
                                <span className="checksum">
                                    {this.state.checksum}
                                </span>
                            </div>
                            <Button color="secondary" size="small" onClick={() => ClipboardHelper.copy(`${this.state.hash}${this.state.checksum}`)}>Copy</Button>
                        </div>
                        {this.state.hashType === "address" && (
                            <div className="row">
                                <div className="label">Balance</div>
                                <div className="value">{UnitsHelper.formatBest(this.state.balance)}</div>
                            </div>
                        )}
                        {this.state.transactionsCount && (
                            <div className="row">
                                <div className="label">Number of Transactions</div>
                                <div className="value">{this.state.transactionsCount}</div>
                            </div>
                        )}
                        <hr />
                        <div className="items">
                            {this.state.transactionHashes.map((t, idx) => (
                                <Link className="nav-link" key={idx} to={`/transaction/${t}${network}`}>{t}</Link>
                            ))}
                        </div>
                    </div>
                )}
                {this.state.transactionHashes && this.state.hashType === "bundle" && (
                    <React.Fragment>
                        <Heading level={1}>Bundle</Heading>
                        <BundleObject hash={this.state.hash} network={this.state.network} transactionHashes={this.state.transactionHashes} />
                    </React.Fragment>
                )}
            </div>
        );
    }

    /**
     * Validate the form fields.
     * @returns True if the form is valid.
     */
    private validate(): boolean {
        let validMessage = "";
        if (!this.state.hash) {
            validMessage = "You must fill in the hash.";
        } else {
            if (this.state.hashType === "address") {
                if (!isHash(this.state.hash)) {
                    validMessage = "The address hash must contain A-Z or 9 and be 81 or 90 trytes in length.";
                }
            } else if (this.state.hashType === "transaction" || this.state.hashType === "bundle") {
                if (!isTrytesOfExactLength(this.state.hash, 81)) {
                    validMessage = `The ${this.state.hashType} hash must contain A-Z or 9 and be 81 trytes in length.`;
                }
            } else {
                if (!isTag(this.state.hash)) {
                    validMessage = `The tag hash must contain A-Z or 9 and be a maximum 27 trytes in length.`;
                }
            }
        }

        if (this._mounted) {
            this.setState({ validMessage, isValid: validMessage.length === 0 });
        }
        return validMessage.length === 0;
    }

    /**
     * Load the data from the tangle.
     */
    private async loadData(): Promise<void> {
        if (this._mounted) {

            this.setState({ isBusy: true, isErrored: false, status: `Loading from ${this.state.network} tangle, please wait...` }, async () => {
                try {
                    let transactionTrytes;
                    let transactionHashes;
                    let checksum = "";
                    let status = "";
                    let balance = 0;
                    let isErrored = false;
                    let transactionsCount = "";

                    if (this.state.hashType === "transaction") {
                        const response = await this._tangleCacheService.getTransactions([this.state.hash], this.state.network);
                        if (response && response.length > 0) {
                            transactionTrytes = response[0];
                        } else {
                            status = "Unable to find transaction on the tangle.";
                        }
                    } else {
                        try {
                            const response = await this._tangleCacheService.findTransactionHashes(this.state.hashType, this.state.hash, this.state.network);

                            if (response && response.length > 0) {
                                transactionHashes = response;

                                if (this.state.hashType === "address") {
                                    balance = await this._tangleCacheService.getAddressBalance(this.state.hash, this.state.network);
                                    checksum = addChecksum(this.state.hash).substr(-9);
                                }
                            } else {
                                status = `Unable to find any transactions with the specified ${this.state.hashType} on the tangle, or the number of items was too large to return.`;
                            }
                        } catch (err) {
                            status = `An error occured while trying to retrieve the transactions with the specified ${this.state.hashType} on the tangle.\n\n${err.message}`;
                            isErrored = true;
                        }
                    }

                    if (transactionHashes) {
                        if (transactionHashes.length > 250) {
                            const all = transactionHashes.length;
                            transactionHashes = transactionHashes.slice(0, 250);
                            transactionsCount = `${transactionHashes.length} of ${all}`;
                        } else {
                            transactionsCount = `${transactionHashes.length}`;
                        }
                    }

                    if (this._mounted) {
                        this.setState({
                            isBusy: false,
                            status,
                            transactionTrytes,
                            transactionHashes,
                            transactionsCount,
                            balance,
                            checksum,
                            isErrored
                        });
                    }
                } catch (err) {
                    if (this._mounted) {
                        this.setState({ isBusy: false, isErrored: true, status: err.message });
                    }
                }
            });
        }
    }
}

export default ExploreView;
