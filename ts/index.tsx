import * as React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, Store as ReduxStore } from 'redux';
import {App} from 'ts/components/app';
import {State, reducer} from 'ts/redux/reducer';
import {colors, getMuiTheme, MuiThemeProvider} from 'material-ui/styles';
import * as injectTapEventPlugin from 'react-tap-event-plugin';
injectTapEventPlugin();

import 'basscss/css/basscss.css';

const muiTheme = getMuiTheme({
    palette: {
        primary1Color: colors.amber600,
        primary2Color: colors.blueGrey500,
        textColor: colors.blueGrey600,
    },
});

const store: ReduxStore<State> = createStore(reducer);

render(
    <Provider store={store}>
        <MuiThemeProvider muiTheme={muiTheme}>
            <App />
        </MuiThemeProvider>
    </Provider>,
    document.getElementById('app'),
);