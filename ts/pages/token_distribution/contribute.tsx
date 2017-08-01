import * as _ from 'lodash';
import * as React from 'react';
import * as DocumentTitle from 'react-document-title';
import * as BigNumber from 'bignumber.js';
import * as moment from 'moment';
import ReactTooltip = require('react-tooltip');
import {colors} from 'material-ui/styles';
import Paper from 'material-ui/Paper';
import CircularProgress from 'material-ui/CircularProgress';
import {ZeroEx} from '0x.js';
import {utils} from 'ts/utils/utils';
import {Blockchain} from 'ts/blockchain';
import {constants} from 'ts/utils/constants';
import {Footer} from 'ts/components/footer';
import {TopBar} from 'ts/components/top_bar';
import {BlockchainErrs, ProviderType, EtherscanLinkSuffixes, ScreenWidths, TokenSaleErrs} from 'ts/types';
import {Dispatcher} from 'ts/redux/dispatcher';
import {FlashMessage} from 'ts/components/ui/flash_message';
import {BlockchainErrDialog} from 'ts/components/blockchain_err_dialog';
import {EthAmountInput} from 'ts/components/inputs/eth_amount_input';
import {LedgerConfigDialog} from 'ts/components/ledger_config_dialog';
import {U2fNotSupportedDialog} from 'ts/components/u2f_not_supported_dialog';
import {LabeledSwitcher} from 'ts/components/ui/labeled_switcher';
import {Party} from 'ts/components/ui/party';
import {LifeCycleRaisedButton} from 'ts/components/ui/lifecycle_raised_button';
import {SaleStats} from 'ts/pages/token_distribution/sale_stats';
import {Loading} from 'ts/components/ui/loading';

const CUSTOM_GRAY = '#464646';
const CUSTOM_LIGHT_GRAY = '#BBBBBB';
const ZRX_ETH_DECIMAL_PLACES = 18;
const THROTTLE_TIMEOUT = 100;

export interface ContributeProps {
    location: Location;
    dispatcher: Dispatcher;
    blockchainIsLoaded: boolean;
    networkId: number;
    nodeVersion: string;
    providerType: ProviderType;
    injectedProviderName: string;
    userAddress: string;
    userEtherBalance: BigNumber.BigNumber;
    flashMessage?: string|React.ReactNode;
    blockchainErr: BlockchainErrs;
    shouldBlockchainErrDialogBeOpen: boolean;
    screenWidth: ScreenWidths;
}

interface ContributeState {
    contributionAmountInBaseUnits?: BigNumber.BigNumber;
    prevNetworkId: number;
    prevNodeVersion: string;
    prevUserAddress: string;
    prevProviderType: ProviderType;
    prevBlockchainIsLoaded: boolean;
    isLedgerDialogOpen: boolean;
    isU2FDialogOpen: boolean;
    zrxSold: BigNumber.BigNumber;
    zrxToEthExchangeRate?: BigNumber.BigNumber;
    ethContributedAmount?: BigNumber.BigNumber;
    baseEthCapPerAddress?: BigNumber.BigNumber;
    startTimeInSec?: BigNumber.BigNumber;
    totalZrxSupply: BigNumber.BigNumber;
    isAddressRegistered: boolean;
    didLoadConstantTokenSaleInfo: boolean;
}

export class Contribute extends React.Component<ContributeProps, ContributeState> {
    private blockchain: Blockchain;
    private throttledScreenWidthUpdate: () => void;
    constructor(props: ContributeProps) {
        super(props);
        this.throttledScreenWidthUpdate = _.throttle(this.updateScreenWidth.bind(this), THROTTLE_TIMEOUT);
        this.state = {
            prevNetworkId: this.props.networkId,
            prevNodeVersion: this.props.nodeVersion,
            prevUserAddress: this.props.userAddress,
            prevProviderType: this.props.providerType,
            prevBlockchainIsLoaded: this.props.blockchainIsLoaded,
            isLedgerDialogOpen: false,
            isU2FDialogOpen: false,
            zrxSold: new BigNumber(0),
            totalZrxSupply: ZeroEx.toBaseUnitAmount(new BigNumber(500000000), 18),
            isAddressRegistered: false,
            didLoadConstantTokenSaleInfo: false,
        };
    }
    public componentDidMount() {
        window.addEventListener('resize', this.throttledScreenWidthUpdate);
        window.scrollTo(0, 0);
    }
    public componentWillUnmount() {
        window.removeEventListener('resize', this.throttledScreenWidthUpdate);
    }
    public componentWillMount() {
        this.blockchain = new Blockchain(this.props.dispatcher);
    }
    public componentWillReceiveProps(nextProps: ContributeProps) {
        if (nextProps.networkId !== this.state.prevNetworkId) {
            this.blockchain.networkIdUpdatedFireAndForgetAsync(nextProps.networkId);
            this.setState({
                prevNetworkId: nextProps.networkId,
            });
        }
        if (nextProps.userAddress !== this.state.prevUserAddress) {
            this.blockchain.userAddressUpdatedFireAndForgetAsync(nextProps.userAddress);
            this.setState({
                prevUserAddress: nextProps.userAddress,
            });
        }
        if (nextProps.nodeVersion !== this.state.prevNodeVersion) {
            this.blockchain.nodeVersionUpdatedFireAndForgetAsync(nextProps.nodeVersion);
            this.setState({
                prevNodeVersion: nextProps.nodeVersion,
            });
        }
        if (nextProps.providerType !== this.state.prevProviderType) {
            this.blockchain.providerTypeUpdatedFireAndForgetAsync(nextProps.providerType);
            this.setState({
                prevProviderType: nextProps.providerType,
            });
        }
        if (this.state.prevBlockchainIsLoaded !== nextProps.blockchainIsLoaded) {
            if (nextProps.blockchainIsLoaded) {
                this.updateConstantTokenSaleInfoFireAndForgetAsync();
            }
            this.setState({
                prevBlockchainIsLoaded: nextProps.blockchainIsLoaded,
            });
        }
        if (nextProps.blockchainIsLoaded) {
            this.updateVariableTokenSaleInfoFireAndForgetAsync();
        }
    }
    public render() {
        const contributeStyle: React.CSSProperties = {
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: CUSTOM_GRAY,
        };
        const updateShouldBlockchainErrDialogBeOpen = this.props.dispatcher
                .updateShouldBlockchainErrDialogBeOpen.bind(this.props.dispatcher);
        return (
            <div style={contributeStyle}>
                <DocumentTitle title="Contribute"/>
                <TopBar
                    blockchainIsLoaded={false}
                    location={this.props.location}
                />
                {this.props.blockchainIsLoaded ?
                  this.renderContributionForm() :
                  <div className="pt4">
                      <Loading />
                 </div>
                }
                <Footer />
                <BlockchainErrDialog
                    blockchain={this.blockchain}
                    blockchainErr={this.props.blockchainErr}
                    isOpen={this.props.shouldBlockchainErrDialogBeOpen}
                    userAddress={this.props.userAddress}
                    toggleDialogFn={updateShouldBlockchainErrDialogBeOpen}
                />
                <FlashMessage
                    dispatcher={this.props.dispatcher}
                    flashMessage={this.props.flashMessage}
                    showDurationMs={10000}
                    bodyStyle={{backgroundColor: constants.CUSTOM_BLUE}}
                />
                <LedgerConfigDialog
                    blockchain={this.blockchain}
                    dispatcher={this.props.dispatcher}
                    toggleDialogFn={this.onToggleLedgerDialog.bind(this)}
                    isOpen={this.state.isLedgerDialogOpen}
                />
                <U2fNotSupportedDialog
                    isOpen={this.state.isU2FDialogOpen}
                    onToggleDialog={this.onToggleU2FDialog.bind(this)}
                />
            </div>
        );
    }
    private renderContributionForm() {
        const style = {
            height: '60vh',
            width: '60vw',
            display: 'inline-block',
        };
        if (!_.isUndefined(this.state.startTimeInSec) && this.state.startTimeInSec.gt(moment().unix())) {
            const startTime = moment.unix(this.state.startTimeInSec.toNumber());
            return (
                <div className="block mx-auto pt4">
                    <Paper style={style} zDepth={1}>
                        <div className="flex items-center justify-center fit" style={{height: '100%'}}>
                            <div className="self-center">
                                Contribution period had not started yet!
                                <br/>
                                Start time: {startTime.format('MMMM Do h:mm:ss a')}
                            </div>
                        </div>
                    </Paper>
                </div>
            );
        }
        const now = moment().unix();
        const nextPeriodTimestamp = now + constants.CAP_PERIOD_IN_SEC;
        const capPeriodEndIfExists = this.getCapPeriodEndTimestampIfExists();
        const labelLeft = this.props.injectedProviderName !== constants.PUBLIC_PROVIDER_NAME ?
                        this.props.injectedProviderName :
                        'Injected Web3';
        const isLedgerProvider = this.props.providerType === ProviderType.LEDGER;
        let ZRXAmountToReceive = 0;
        if (!_.isUndefined(this.state.contributionAmountInBaseUnits)) {
            const zrxEquivalentAmount = this.state.contributionAmountInBaseUnits.mul(this.state.zrxToEthExchangeRate);
            ZRXAmountToReceive = this.formatCurrencyAmount(zrxEquivalentAmount);
        }
        const tokenSaleAddress = this.blockchain.getTokenSaleAddress();
        const etherscanTokenSaleContractUrl = utils.getEtherScanLinkIfExists(tokenSaleAddress,
                                                                           this.props.networkId,
                                                                           EtherscanLinkSuffixes.address);
        return (
            <div className="clearfix max-width-4 mx-auto" style={{paddingTop: 43, width: '100%'}}>
                {this.props.screenWidth === ScreenWidths.SM &&
                    this.renderSaleStats(capPeriodEndIfExists)
                }
                <div className="col lg-col-9 md-col-9 col-12">
                    <div className="mx-auto sm-px2" style={{maxWidth: 530}}>
                        <div className="h2 pt3">Make a contribution</div>
                        <div className="clearfix pt3">
                            <div className="col col-1">
                                {this.renderStepNumber(1)}
                            </div>
                            <div className="col col-11">
                                <div className="h3">Select your wallet:</div>
                                <div className="pt2 pb3 mx-auto" style={{maxWidth: 440}}>
                                    <LabeledSwitcher
                                        labelLeft={labelLeft}
                                        labelRight="Ledger Nano S"
                                        isLeftInitiallySelected={!isLedgerProvider}
                                        onLeftLabelClickAsync={this.onInjectedWeb3Click.bind(this)}
                                        onRightLabelClickAsync={this.onLedgerClickAsync.bind(this)}
                                    />
                                    <div
                                        className="clearfix"
                                        style={{fontSize: 14, color: '#635F5E', paddingTop: 11}}
                                    >
                                        <div className="col col-6 center">
                                            <div>
                                                address connected via Web3
                                            </div>
                                            <div>
                                                (i.e{' '}
                                                <a
                                                    className="underline"
                                                    style={{color: '#635F5E'}}
                                                    href={constants.METAMASK_CHROME_STORE_URL}
                                                    target="_blank"
                                                >
                                                    Metamask
                                                </a>{' '}or{' '}
                                                <a
                                                    className="underline"
                                                    style={{color: '#635F5E'}}
                                                    href={constants.PARITY_CHROME_STORE_URL}
                                                    target="_blank"
                                                >
                                                    Parity Signer
                                                </a>)
                                            </div>
                                        </div>
                                        <div className="col col-6 center">
                                            Ledger hardware wallet
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="clearfix">
                            <div className="col col-5">
                                <Party
                                    label="Your address"
                                    address={this.props.userAddress}
                                    identiconDiameter={30}
                                    identiconStyle={{marginTop: 10, marginBottom: 10}}
                                    noAddressLabel="No address found"
                                />
                                <div
                                    className="pt1 mx-auto center"
                                    style={{fontSize: 12, maxWidth: 132}}
                                >
                                    {!_.isEmpty(this.props.userAddress) && this.state.didLoadConstantTokenSaleInfo &&
                                        <div className="pb1">
                                            {this.state.isAddressRegistered ?
                                                <div style={{color: 'rgb(0, 195, 62)'}}>
                                                    <span><i className="zmdi zmdi-check-circle" /></span>{' '}
                                                    <span>Address registered</span>
                                                </div> :
                                                <div
                                                    style={{color: colors.red500}}
                                                    data-tip={true}
                                                    data-for="notRegisteredTooltip"
                                                >
                                                    <span><i className="zmdi zmdi-alert-triangle" /></span>{' '}
                                                    <span>Unregistered address</span>
                                                    <ReactTooltip id="notRegisteredTooltip">
                                                        You can only contribute from an address that was<br />
                                                        registered during the mandatory registration period<br />
                                                        (Aug. 9th-12th).
                                                    </ReactTooltip>
                                                </div>
                                            }
                                        </div>
                                    }
                                    <div>
                                        ZRX will be instantly sent to this address
                                    </div>
                                </div>
                            </div>
                            <div className="col col-2">
                                <div className="mx-auto" style={{width: 17, marginTop: 24}}>
                                    <i
                                        style={{fontSize: 54, color: '#DDDDDD'}}
                                        className="zmdi zmdi-chevron-right"
                                    />
                                </div>
                            </div>
                            <div className="col col-5">
                                <Party
                                    label="ZRX sale address"
                                    address={tokenSaleAddress}
                                    identiconDiameter={30}
                                    identiconStyle={{marginTop: 10, marginBottom: 10}}
                                    noAddressLabel="No address found"
                                />
                                <div
                                    className="pt1 mx-auto center underline"
                                    style={{width: 108, cursor: 'pointer'}}
                                >
                                    <a
                                        style={{color: '#00C33E', fontSize: 12}}
                                        href={etherscanTokenSaleContractUrl}
                                        target="_blank"
                                    >
                                        Verify source code on Etherscan
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div className="clearfix pt3">
                            <div className="col col-1">
                                {this.renderStepNumber(2)}
                            </div>
                            <div className="col col-11">
                                <div className="h3">Choose an amount:</div>
                                <div className="clearfix">
                                    <div className="col col-6" style={{maxWidth: 235}}>
                                        <EthAmountInput
                                            amount={this.state.contributionAmountInBaseUnits}
                                            balance={this.props.userEtherBalance}
                                            shouldCheckBalance={true}
                                            shouldShowIncompleteErrs={false}
                                            onChange={this.onContributionAmountChanged.bind(this)}
                                            shouldHideVisitBalancesLink={true}
                                        />
                                    </div>
                                    {ZRXAmountToReceive !== 0 &&
                                        <div
                                            className="col col-6 pl1"
                                            style={{color: CUSTOM_LIGHT_GRAY, paddingTop: 15}}
                                        >
                                            = {ZRXAmountToReceive} ZRX
                                        </div>
                                    }
                                </div>
                                <div style={{fontSize: 13}}>
                                    <div>
                                        <div>
                                            <span style={{color: CUSTOM_LIGHT_GRAY}}>
                                                current contribution cap:{' '}
                                            </span>
                                            <span style={{color: CUSTOM_GRAY}}>
                                                {this.renderEthCapPerAddress(now)} ETH/participant
                                            </span>
                                        </div>
                                        <div className="pt1">
                                            <span style={{color: CUSTOM_LIGHT_GRAY}}>
                                                cap increases to:{' '}
                                                <span style={{color: CUSTOM_GRAY}}>
                                                    {this.renderEthCapPerAddress(nextPeriodTimestamp)} ETH
                                                </span>{' '}
                                                {this.renderTimeUntilCapIncrease(capPeriodEndIfExists)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pt1">
                                        <span style={{color: CUSTOM_LIGHT_GRAY}}>
                                            contributed from your address so far:{' '}
                                        </span>
                                        <span style={{color: CUSTOM_GRAY}}>
                                            {_.isUndefined(this.state.ethContributedAmount) ?
                                                <span style={{paddingRight: 3, paddingLeft: 3}}>
                                                    <CircularProgress size={10} />
                                                </span> :
                                                this.formatCurrencyAmount(this.state.ethContributedAmount)
                                            } ETH
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="clearfix pt3">
                            <div className="col col-1">
                                {this.renderStepNumber(3)}
                            </div>
                            <div className="col col-11">
                                <div className="h3 pb2">Verify information and purchase ZRX</div>
                                <LifeCycleRaisedButton
                                    labelReady="Purchase ZRX"
                                    labelLoading="Purchasing ZRX..."
                                    labelComplete="ZRX purchased!"
                                    isPrimary={true}
                                    isDisabled={_.isEmpty(this.props.userAddress) ||
                                                _.isUndefined(this.state.contributionAmountInBaseUnits)}
                                    onClickAsyncFn={this.onPurchaseZRXClickAsync.bind(this)}
                                />
                                <div
                                    className="pt2 pb4 center"
                                    style={{color: CUSTOM_LIGHT_GRAY, fontSize: 13}}
                                >
                                    To avoid issues and phishing scams we highly recommend
                                    you check your address, and verify the 0x address with
                                    Etherscan before you continue
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {this.props.screenWidth !== ScreenWidths.SM &&
                    this.renderSaleStats(capPeriodEndIfExists)
                }
            </div>
        );
    }
    private renderSaleStats(capPeriodEndIfExists: number) {
        return (
            <div className="col lg-col-3 md-col-3 col-12">
                <div className="lg-pt4 md-pt4 sm-pt2">
                    <SaleStats
                        isLoading={!this.state.didLoadConstantTokenSaleInfo}
                        totalZrxSupply={this.state.totalZrxSupply}
                        zrxSold={this.state.zrxSold}
                        capPeriodEnd={_.isUndefined(capPeriodEndIfExists) ? 0 : capPeriodEndIfExists}
                    />
                </div>
            </div>
        );
    }
    private renderTimeUntilCapIncrease(capPeriodEndIfExists: number) {
        if (_.isUndefined(capPeriodEndIfExists)) {
            return null;
        }
        const capIncreaseFromNow = moment.unix(capPeriodEndIfExists).fromNow();
        return capIncreaseFromNow;
    }
    private renderEthCapPerAddress(timestamp: number) {
        if (_.isUndefined(this.state.baseEthCapPerAddress)) {
            return (
                <span style={{paddingRight: 3, paddingLeft: 3}}>
                    <CircularProgress size={10} />
                </span>
            );
        }
        const currentEthCapPerAddressInWei = this.getEthCapPerAddressAtTimestamp(timestamp);
        const currentEthCapPerAddress = this.formatCurrencyAmount(currentEthCapPerAddressInWei);
        return currentEthCapPerAddress;
    }
    private renderStepNumber(n: number) {
        const numberedCircleStyles = {
            width: 22,
            height: 22,
            color: 'white',
            backgroundColor: 'rgb(216, 216, 216)',
            textAlign: 'center',
            lineHeight: '24px',
            fontSize: 13,
        };
        return (
            <div
                className="circle"
                style={numberedCircleStyles}
            >
                {n}
            </div>
        );
    }
    private renderTransactionSuccessfulMsg(transactionHex: string) {
        const etherscanLink = utils.getEtherScanLinkIfExists(transactionHex, this.props.networkId,
                                                             EtherscanLinkSuffixes.tx);
        return (
            <div>
                Your transaction was successfully mined!{' '}
                <a
                    href={etherscanLink}
                    target="_blank"
                    className="underline"
                    style={{color: 'white'}}
                >
                    View your transaction
                </a>
            </div>
        );
    }
    private async updateConstantTokenSaleInfoFireAndForgetAsync() {
        const [
            zrxToEthExchangeRate,
            baseEthCapPerAddress,
            startTimeInSec,
            totalZrxSupply,
        ] = await Promise.all([
            this.blockchain.getTokenSaleExchangeRateAsync(),
            this.blockchain.getTokenSaleBaseEthCapPerAddressAsync(),
            this.blockchain.getTokenSaleStartTimeInSecAsync(),
            this.blockchain.getTokenSaleTotalSupplyAsync(),
        ]);

        this.setState({
            zrxToEthExchangeRate,
            baseEthCapPerAddress,
            startTimeInSec,
            totalZrxSupply,
            didLoadConstantTokenSaleInfo: true,
        });
    }
    private async updateVariableTokenSaleInfoFireAndForgetAsync() {
        const orderHash = await this.blockchain.getTokenSaleOrderHashAsync();
        const ethContributedInWei = await this.blockchain.getFillAmountAsync(orderHash);
        const ethContributed = ZeroEx.toUnitAmount(ethContributedInWei, ZRX_ETH_DECIMAL_PLACES);
        const zrxToEthExchangeRate = await this.blockchain.getTokenSaleExchangeRateAsync();
        const zrxSold = ethContributed.mul(zrxToEthExchangeRate);

        let ethContributedAmount = new BigNumber(0);
        let isAddressRegistered = false;
        if (!_.isEmpty(this.props.userAddress)) {
            ethContributedAmount = await this.blockchain.getTokenSaleContributionAmountAsync();
            isAddressRegistered = await this.blockchain.getTokenSaleIsUserAddressRegisteredAsync();
        }

        this.setState({
            zrxSold,
            ethContributedAmount,
            isAddressRegistered,
        });
    }
    private onContributionAmountChanged(isValid: boolean, contributionAmountInBaseUnits?: BigNumber.BigNumber) {
        this.setState({
            contributionAmountInBaseUnits,
        });
    }
    private onToggleLedgerDialog(isOpen: boolean) {
        this.setState({
            isLedgerDialogOpen: isOpen,
        });
    }
    private onToggleU2FDialog() {
        this.setState({
            isU2FDialogOpen: !this.state.isU2FDialogOpen,
        });
    }
    private async onInjectedWeb3Click(): Promise<boolean> {
        this.props.dispatcher.updateProviderType(ProviderType.INJECTED);
        return true;
    }
    private async onLedgerClickAsync(): Promise<boolean> {
        const isU2FSupported = await utils.isU2FSupportedAsync();
        if (!isU2FSupported) {
            this.setState({
                isU2FDialogOpen: true,
            });
            return false;
        }

        this.props.dispatcher.updateProviderType(ProviderType.LEDGER);
        this.setState({
            isLedgerDialogOpen: true,
        });
        return true;
    }
    private formatCurrencyAmount(amount: BigNumber.BigNumber): number {
        const unitAmount = ZeroEx.toUnitAmount(amount, ZRX_ETH_DECIMAL_PLACES);
        const roundedUnitAmount = Math.round(unitAmount.toNumber() * 100000) / 100000;
        return roundedUnitAmount;
    }
    private async onPurchaseZRXClickAsync(): Promise<boolean> {
        const contributionAmountInUnits = ZeroEx.toUnitAmount(this.state.contributionAmountInBaseUnits,
                                                              ZRX_ETH_DECIMAL_PLACES);
        if (this.props.userEtherBalance.lt(contributionAmountInUnits)) {
            this.props.dispatcher.showFlashMessage('Insufficient Ether balance to complete this transaction');
            return false;
        }
        const isAmountBelowCurrentCap = this.isAmountBelowCurrentCap();
        if (!isAmountBelowCurrentCap) {
            const desiredContributionAmount = this.formatCurrencyAmount(this.state.contributionAmountInBaseUnits);
            const errMsg = `Cannot contribute ${desiredContributionAmount} ETH without exceeding the current cap`;
            this.props.dispatcher.showFlashMessage(errMsg);
            return false;
        }

        try {
            const transactionHex = await this.blockchain.tokenSaleFillOrderWithEthAsync(
                this.state.contributionAmountInBaseUnits,
            );
            const transactionSuccessMsg = this.renderTransactionSuccessfulMsg(transactionHex);
            this.props.dispatcher.showFlashMessage(transactionSuccessMsg);
            return true;
        } catch (err) {
            const errMsg = `${err}`;
            if (utils.didUserDenyWeb3Request(errMsg)) {
                this.props.dispatcher.showFlashMessage('You denied the transaction confirmation');
            } else if (_.includes(errMsg, TokenSaleErrs.ADDRESS_NOT_REGISTERED)) {
                this.props.dispatcher.showFlashMessage('You cannot contribute from an unregistered address');
            } else if (_.includes(errMsg, 'TOO_OLD_LEDGER_FIRMWARE')) {
                this.props.dispatcher.showFlashMessage('Your Ledger firmware is too old. Please update it.');
            } else {
                utils.consoleLog(`Sending transaction failed: ${err}`);
                this.props.dispatcher.showFlashMessage(
                    'Failed to complete transaction. Please try again.',
                );
            }
            return false;
        }
    }
    private isAmountBelowCurrentCap(): boolean {
        const nowTimestamp = moment().unix();
        const ethCapPerAddress = this.getEthCapPerAddressAtTimestamp(nowTimestamp);
        const desiredContributionAmount = this.state.contributionAmountInBaseUnits.add(this.state.ethContributedAmount);
        const isBelowCap = ethCapPerAddress.gte(desiredContributionAmount);
        return isBelowCap;
    }
    private getEthCapPerAddressAtTimestamp(timestamp: number): BigNumber.BigNumber {
        const period = this.getCapPeriod(timestamp);
        const multiplier = (2 ** period) - 1;
        const ethCapPerAddress = this.state.baseEthCapPerAddress.mul(multiplier);
        return ethCapPerAddress;
    }
    private getCapPeriod(timestamp: number): number {
        const timestampBigNumber = new BigNumber(timestamp);
        const secondsSinceStart = timestampBigNumber.minus(this.state.startTimeInSec);
        const period = secondsSinceStart.div(constants.CAP_PERIOD_IN_SEC).round(0, 1).add(1);
        return period.toNumber();
    }
    private getCapPeriodEndTimestampIfExists(): number {
        if (_.isUndefined(this.state.startTimeInSec)) {
            return undefined;
        }
        const now = moment().unix();
        const period = this.getCapPeriod(now);
        const capPeriodEndTimestamp = this.state.startTimeInSec.add(constants.CAP_PERIOD_IN_SEC * period);
        return capPeriodEndTimestamp.toNumber();
    }
    private updateScreenWidth() {
        const newScreenWidth = utils.getScreenWidth();
        this.props.dispatcher.updateScreenWidth(newScreenWidth);
    }
}
