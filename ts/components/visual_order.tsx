import * as _ from 'lodash';
import * as React from 'react';
import {utils} from 'ts/utils/utils';
import {constants} from 'ts/utils/constants';
import {Direction, SideToAssetToken, Side, AssetToken, Token} from 'ts/types';
import {Party} from 'ts/components/ui/party';
import {ZeroEx} from 'ts/utils/zero_ex';

const PRECISION = 5;
const IDENTICON_DIAMETER = 100;

interface VisualOrderProps {
    orderTakerAddress: string;
    orderMakerAddress: string;
    makerAssetToken: AssetToken;
    takerAssetToken: AssetToken;
    makerToken: Token;
    takerToken: Token;
}

interface VisualOrderState {}

export class VisualOrder extends React.Component<VisualOrderProps, VisualOrderState> {
    public render() {
        return (
            <div>
                <div className="clearfix">
                    <div className="col col-5 center">
                        <Party
                            label="Maker"
                            address={this.props.orderMakerAddress}
                            identiconDiameter={IDENTICON_DIAMETER}
                        />
                    </div>
                    <div className="col col-2 center" style={{paddingTop: 25}}>
                        <div style={{paddingBottom: 6}}>
                            {this.renderAmount(this.props.makerAssetToken, this.props.makerToken)}
                        </div>
                        <div className="relative mx-auto" style={{width: 69, height: 54}}>
                            <div className="absolute" style={{top: -18, left: 1}}>
                                <i style={{fontSize: 90}} className="zmdi zmdi-swap" />
                            </div>
                        </div>
                        <div style={{paddingTop: 8}}>
                            {this.renderAmount(this.props.takerAssetToken, this.props.takerToken)}
                        </div>
                    </div>
                    <div className="col col-5 center">
                        <Party
                            label="Taker"
                            address={this.props.orderTakerAddress}
                            identiconDiameter={IDENTICON_DIAMETER}
                        />
                    </div>
                </div>
            </div>
        );
    }
    private renderAmount(assetToken: AssetToken, token: Token) {
        const unitAmount = ZeroEx.toUnitAmount(assetToken.amount, token.decimals);
        return (
            <div style={{fontSize: 13}}>
                {unitAmount.toNumber().toFixed(PRECISION)} {token.symbol}
            </div>
        );
    }
}
