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
          minDurationMs={500}>
        <Animated.View style={this.props.container}>
          <View style={this.props.container}>
                
                
                <View style={styles.button}
                >
                  <Text > {this.props.label} </Text>
                </View>
          </View>
        </Animated.View>
      </LongPressGestureHandler>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    right: 0
  },
  button: {
    width:50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 52, 52, 0.1)'
  }
})