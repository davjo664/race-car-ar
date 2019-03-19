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

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  TapGestureHandler,
  RotationGestureHandler,
  PanGestureHandler,
  State,
  LongPressGestureHandler
} from 'react-native-gesture-handler';

export default class Button extends Component {
 render() {
    return (
      <LongPressGestureHandler
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              this.props.handlePress();
            } else {
              this.props.handleRelease();
            }
          }}
          minDurationMs={100}>
        <Animated.View style={{flex: 1}}>
          <View style={styles.button}
          >
          <MaterialCommunityIcons name={"arrow-"+this.props.name+"-bold-box-outline"} size={80} color="white" />
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
    // backgroundColor: 'rgba(52, 52, 52, 0.5)'
  }
})