import React, { Component } from 'react'
import {
  AppRegistry,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableHighlight,
  Text,
  View,
  Animated
} from 'react-native'

import {
  TapGestureHandler,
  RotationGestureHandler,
  PanGestureHandler,
  State,
  LongPressGestureHandler
} from 'react-native-gesture-handler';

export default class Button extends Component {
  constructor(props) {
    super(props)
    this.props = props;
    this.state = { count: 0 }
  }

  handlePressIn = () => {
    this.setState({
      count: this.state.count+1
    })
    this.props.onPressIn();
  }

  handlePressOut = () => {
    this.props.onPressOut();
  }

 render() {
    return (
      <LongPressGestureHandler
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              // console.log("LONG");
              this.props.handlePress();
            } else {
              // console.log("END LONG");
              this.props.handleRelease();
            }
          }}
          minDurationMs={100}>
        <Animated.View style={{flex: 1}}>
          <View style={styles.button}
          >
            <Text style={{color:'white'}}> {this.props.label} </Text>
          </View>
        </Animated.View>
      </LongPressGestureHandler>
    )
  }
}

const styles = StyleSheet.create({
  button: {
    flex:1,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 52, 52, 0.5)'
  }
})