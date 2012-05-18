//
// EKS Otus HID controller script v0.01
// Copyright (C) 2012, Sean M. Pappalardo, Ilkka Tuohela
// but feel free to tweak this to your heart's content!
// For Mixxx version 1.11.x
//

EksOtus = new HIDController();

// Valid values: 1 for mouse mode, 0 for xy-pad mode
EksOtus.trackpadMode = 0;
EksOtus.LEDUpdateInterval = 300;
EksOtus.version_major = undefined;
EksOtus.version_minor = undefined;

// Timers and toggles
EksOtus.deckSwitchClicked = false;
EksOtus.deckSwitchClickTimer = undefined;
EksOtus.initAnimationTimer = undefined;

// Supported LED control color values for each LED
EksOtus.LEDColors = { off: 0x0, red: 0x0f, green: 0xf0, amber: 0xff };

// Ignore timestamps and packet numbers in control changes.
// Button mask is processed separately to find individual button presses.
EksOtus.ignoredControlChanges = [
    'mask','timestamp','packet_number','deck_status', 'wheel_position'
];

// Wheel LEDs are handled in 2 packets ('left' and 'right'). We parse LED
// name directly, no need to list names. There are total 60 wheel LEDs.
EksOtus.WheelLEDCount = 60;
// Total 22 button LEDs, starting from right top corner
EksOtus.ButtonLEDCount = 22;
// Total 20 slider LEDs, 17 for slider and 3 for selector
EksOtus.SliderLedCount = 20;

// Initialize control fields, buttons and LEDs
// Group name 'deck' is dynamically modified to active deck, since
// Otus is a dualdeck controller.
EksOtus.registerPackets = function() {
    var packet = undefined;
    var name = undefined;
    var offset = 0;

    var buttons = new HIDBitVector(32);
    var off = EksOtus.ButtonStates.released;
    buttons.addBit(undefined,'jog_ne',0);
    buttons.addBit('deck','beat_8',1);
    buttons.addBit('deck','beat_4',2);
    buttons.addBit('deck','beat_2',3);
    buttons.addBit('deck','beat_1',4);
    buttons.addBit('deck','loop_in',5);
    buttons.addBit('deck','loop_out',6);
    buttons.addBit('deck','reloop_exit',7);
    buttons.addBit('deck','slider_scale',8);
    buttons.addBit('deck','LoadSelectedTrack',9);
    buttons.addBit('modifiers','shift',10);
    buttons.addBit('deck','deck_switch',11,EksOtus.deckSwitch);
    buttons.addBit('deck','pfl',12);
    buttons.addBit(undefined,'jog_sw',13);
    buttons.addBit('deck','stop',14);
    buttons.addBit('deck','play',15);
    buttons.addBit('deck','cue_default',16);
    buttons.addBit('deck','reverse',17);
    buttons.addBit('deck','brake',18);
    buttons.addBit('deck','fastforward',19);
    buttons.addBit(undefined,'jog_nw',20);
    buttons.addBit('deck','jog_touch',21);
    buttons.addBit('[Effects]','trackpad_left',22,EksOtus.xypad);
    buttons.addBit('[Effects]','trackpad_right',23,EksOtus.xypad);
    buttons.addBit(undefined,'hotcue_1',24,EksOtus.hotcue);
    buttons.addBit(undefined,'hotcue_2',25,EksOtus.hotcue);
    buttons.addBit(undefined,'hotcue_3',26,EksOtus.hotcue);
    buttons.addBit(undefined,'hotcue_4',27,EksOtus.hotcue);
    buttons.addBit(undefined,'hotcue_5',28,EksOtus.hotcue);
    buttons.addBit(undefined,'hotcue_6',29,EksOtus.hotcue);
    buttons.addBit('deck','touch_slider',30);
    buttons.addBit('deck','touch_trackpad',31,EksOtus.xypad);

    // Input controller state packet
    packet = new HIDPacket('control',[0x0,0x35],64);
    packet.addField('deck','wheel_position',2,'H');
    packet.addField('deck','jog_wheel',4,'h');
    packet.addField('hid','timestamp',6,'I');
    packet.addField('deck1','slider_value',10,'H');
    packet.addField('deck1','slider_position',12,'H');
    packet.addField(undefined,'jog_ne',14,'B',EksOtus.corner_wheel);
    packet.addField('[Playlist]','SelectTrackKnob',15,'B',undefined,255);
    packet.addField(undefined,'jog_sw',16,'B',EksOtus.corner_wheel);
    packet.addField(undefined,'jog_nw',17,'B',EksOtus.corner_wheel);
    packet.addField('deck1','pregain',18,'H',EksOtus.pregain);
    packet.addField('deck2','pregain',20,'H',EksOtus.pregain);
    packet.addField('deck1','filterHigh',22,'H');
    packet.addField('deck2','filterHigh',24,'H');
    packet.addField('deck1','filterMid',26,'H');
    packet.addField('deck2','filterMid',28,'H');
    packet.addField('deck1','filterLow',30,'H');
    packet.addField('deck2','filterLow',32,'H');
    packet.addField('[Master]','crossfader',34,'H');
    packet.addField('[Master]','headphones',36,'H',EksOtus.headphones);
    packet.addField('[Effects]','trackpad_x',38,'H',EksOtus.xypad);
    packet.addField('[Effects]','trackpad_y',40,'H',EksOtus.xypad);
    packet.addField('deck1','slider_pos_1',42,'H',EksOtus.pitchSlider);
    packet.addField('deck2','slider_pos_2',44,'H',EksOtus.pitchSlider);
    packet.addBitVector(undefined,'mask',46,'I',buttons);
    packet.addField('hid','packet_number',51,'B');
    packet.addField('hid','deck_status',52,'B');
    packet.setIgnored('hid','timestamp',true);
    packet.setIgnored('hid','packet_number',true);
    packet.setIgnored('hid','deck_status',true);

    // Adjust minimum deltas from unstable potentiometers
    packet.setMinDelta('deck1','pregain',128);
    packet.setMinDelta('deck2','pregain',128);
    packet.setMinDelta('deck1','filterHigh',128);
    packet.setMinDelta('deck2','filterHigh',128);
    packet.setMinDelta('deck1','filterMid',128);
    packet.setMinDelta('deck2','filterMid',128);
    packet.setMinDelta('deck1','filterLow',128);
    packet.setMinDelta('deck2','filterLow',128);
    packet.setMinDelta('[Master]','crossfader',128);
    packet.setMinDelta('[Master]','headphones',128);
    EksOtus.registerInputPacket(packet);

    // Input packet to receive device firmware version
    packet = new HIDPacket('firmware_version',[0xa,0x4],64,EksOtus.FirmwareVersionResponse);
    packet.addField('hid','major',2,'B');
    packet.addField('hid','minor',3,'B');
    EksOtus.registerInputPacket(packet);

    // Input packet to receive trackpad mode change response
    packet = new HIDPacket('trackpad_mode',[0x5,0x3],64,EksOtus.TrackpadModeResponse);
    packet.addField('hid','status',2,'B');
    EksOtus.registerInputPacket(packet);

    // Control packet for left wheel LEDs
    packet = new HIDPacket('led_wheel_left',[0x14,0x20],32);
    for (var i=1;i<=EksOtus.WheelLEDCount/2;i++) {
        name = 'wheel_' + i;
        packet.addLEDControl('deck',name,i+1,'B');
    }
    EksOtus.registerOutputPacket(packet);

    // Control packet for right wheel LEDs
    packet = new HIDPacket('led_wheel_right',[0x15,0x20],32);
    for (var i=EksOtus.WheelLEDCount/2+1;i<=EksOtus.WheelLEDCount;i++) {
        name = 'wheel_' + i;
        packet.addLEDControl('deck',name,i+1,'B');
    }
    EksOtus.registerOutputPacket(packet);

    // Control packet for button LEDs
    packet = new HIDPacket('button_leds',[0x16,0x18],32);
    offset = 2;
    packet.addLEDControl('deck','jog_ne',offset++,'B');
    packet.addLEDControl('deck','jog_nw',offset++,'B');
    packet.addLEDControl('deck','jog_sw',offset++,'B');
    packet.addLEDControl('deck','jog_se',offset++,'B');
    packet.addLEDControl('deck','beat_8',offset++,'B');
    packet.addLEDControl('deck','beat_4',offset++,'B');
    packet.addLEDControl('deck','beat_2',offset++,'B');
    packet.addLEDControl('deck','beat_1',offset++,'B');
    packet.addLEDControl('deck','loop_in',offset++,'B');
    packet.addLEDControl('deck','loop_out',offset++,'B');
    packet.addLEDControl('deck','reloop',offset++,'B');
    packet.addLEDControl('deck','eject_right',offset++,'B');
    packet.addLEDControl('deck','deck_switch',offset++,'B');
    packet.addLEDControl('deck','trackpad_right',offset++,'B');
    packet.addLEDControl('deck','trackpad_left',offset++,'B');
    packet.addLEDControl('deck','eject_left',offset++,'B');
    packet.addLEDControl('deck','stop',offset++,'B');
    packet.addLEDControl('deck','play',offset++,'B');
    packet.addLEDControl('deck','brake',offset++,'B');
    packet.addLEDControl('deck','cue_default',offset++,'B');
    packet.addLEDControl('deck','reverse',offset++,'B');
    packet.addLEDControl('deck','fastforward',offset++,'B');
    EksOtus.registerOutputPacket(packet);

    // Slider LEDs
    packet = new HIDPacket('slider_leds',[0x17,0x16],32);
    offset = 2;
    packet.addLEDControl('deck',"slider_1",offset++,'B');
    packet.addLEDControl('deck',"slider_2",offset++,'B');
    packet.addLEDControl('deck',"slider_3",offset++,'B');
    packet.addLEDControl('deck',"slider_4",offset++,'B');
    packet.addLEDControl('deck',"slider_5",offset++,'B');
    packet.addLEDControl('deck',"slider_6",offset++,'B');
    packet.addLEDControl('deck',"slider_7",offset++,'B');
    packet.addLEDControl('deck',"slider_8",offset++,'B');
    packet.addLEDControl('deck',"slider_9",offset++,'B');
    packet.addLEDControl('deck',"slider_10",offset++,'B');
    packet.addLEDControl('deck',"slider_11",offset++,'B');
    packet.addLEDControl('deck',"slider_12",offset++,'B');
    packet.addLEDControl('deck',"slider_13",offset++,'B');
    packet.addLEDControl('deck',"slider_14",offset++,'B');
    packet.addLEDControl('deck',"slider_15",offset++,'B');
    packet.addLEDControl('deck',"slider_16",offset++,'B');
    packet.addLEDControl('deck',"slider_17",offset++,'B');
    packet.addLEDControl('deck',"slider_scale_1",offset++,'B');
    packet.addLEDControl('deck',"slider_scale_2",offset++,'B');
    packet.addLEDControl('deck',"slider_scale_3",offset++,'B');
    EksOtus.registerOutputPacket(packet);

    // Output packet to request firmware version
    packet = new HIDPacket('request_firmware_version',[0xa,0x2],32);
    EksOtus.registerOutputPacket(packet);

    // Output packet to set trackpad mode
    packet = new HIDPacket('set_trackpad_mode',[0x5,0x3],32);
    packet.addField('hid','mode',2,'B');
    EksOtus.registerOutputPacket(packet);

    // Output packet to set LED control mode
    packet = new HIDPacket('set_ledcontrol_mode',[0x1d,0x3],32);
    packet.addField('hid','mode',2,'B');
    EksOtus.registerOutputPacket(packet);

    // Register functions to scale value
    EksOtus.registerScalingFunction('crossfader',EksOtus.plusMinus1Scaler);
    EksOtus.registerScalingFunction('filterLow',EksOtus.eqScaler);
    EksOtus.registerScalingFunction('filterMid',EksOtus.eqScaler);
    EksOtus.registerScalingFunction('filterHigh',EksOtus.eqScaler);
    EksOtus.registerScalingFunction('jog',EksOtus.jogScaler);
    EksOtus.registerScalingFunction('jog_scratch',EksOtus.jogScratchScaler);
}

// Initialize device state
EksOtus.init = function (id) {
    EksOtus.id = id;
    EksOtus.activeDeck = undefined;
    EksOtus.LEDUpdateInterval = 300;

    EksOtus.scratchintervalsPerRev = 512;
    EksOtus.scratchAlpha = 1.0/8;

    EksOtus.rampedScratchEnable = true;
    EksOtus.rampedScratchEnable = true;

    EksOtus.registerPackets();
    EksOtus.updateLEDs();
    EksOtus.setTrackpadMode(EksOtus.trackpadMode);
    EksOtus.requestFirmwareVersion();
    if (EksOtus.LEDUpdateInterval!=undefined) {
        EksOtus.LEDTimer = engine.beginTimer(
            EksOtus.LEDUpdateInterval,
            "EksOtus.updateLEDs(true)"
        );
    }

}

EksOtus.incomingData = function(data,length) {
    EksOtus.parsePacket(data,length);
}

EksOtus.shutdown = function() {
    engine.stopTimer(EksOtus.LEDTimer);
    EksOtus.setLEDControlMode(2);
    EksOtus.setTrackpadMode(1);
    script.HIDDebug("EKS "+EksOtus.id+" shut down");
}

// Jog wheel seek event scaler
EksOtus.jogScaler = function(value) {
    return value/256*3;
}
// Jog wheel scratch event scaler
EksOtus.jogScratchScaler = function(value) {
    if (value>0)
        return 1;
    else
        return -1;
}

// Volume type values scaled from unsigned short to
EksOtus.volumeScaler = function(value) {
    return script.absoluteNonLin(value, 0, 1, 5, 0, 65536);
}

EksOtus.eqScaler = function(value) {
    return script.absoluteNonLin(value, 0, 1, 4, 0, 65536);
}
EksOtus.plusMinus1Scaler = function(value) {
    if (value<32768)
        return value/32768-1;
    else
        return (value-32768)/32768;
}

EksOtus.corner_wheel = function(field) {
    print("CORNER " + field.name + " delta " + field.delta);
}

EksOtus.hotcue = function (field) {
    var command;
    if (field.value==EksOtus.ButtonStates.released)
        return;
    if (EksOtus.activeDeck==undefined)
        return;
    var active_group = EksOtus.resolveGroup(field.group);
    if (EksOtus.modifiers['shift']) {
        command = field.name + '_clear';
    } else {
        command = field.name + '_activate';
    }
    print ("HOTCUE group " + active_group + " name " + field.name + " value " + command);
    engine.setValue(active_group,command,true);
}

EksOtus.pitchSlider = function (field) {
    if (EksOtus.activeDeck==undefined)
        return;
    var active_group = EksOtus.resolveGroup(field.group);
    print ("PITCH group " + active_group + " name " + field.name + " value " + field.value);
}

// Use pregain if modifier shift is active, volume otherwise
EksOtus.pregain = function (field) {
    if (EksOtus.activeDeck==undefined)
        return;
    var active_group = EksOtus.resolveGroup(field.group);
    var value;
    if (EksOtus.modifiers['shift']) {
        value = script.absoluteNonLin(field.value, 0, 1, 5, 0, 65536);
        engine.setValue(active_group,'pregain',value);
    } else {
        value = field.value / 65536;
        engine.setValue(active_group,'volume',value);
    }
}

// Use headphones volume, if modifier shift is active, pre/main mix otherwise
EksOtus.headphones = function (field) {

    if (EksOtus.modifiers['shift']) {
        value = script.absoluteNonLin(field.value, 0, 1, 5, 0, 65536);
        engine.setValue(field.group,'headVolume',value);
    } else {
        value = EksOtus.plusMinus1Scaler(field.value);
        engine.setValue(field.group,'headMix',value);
    }
}

EksOtus.SelectTrack = function(field) {
    print("SELECT TRACK " + field.group + " name " + field.name + " value " + field.value + " delta " + field.delta);
}

// Control effects or somethig with XY pad
EksOtus.xypad = function(field) {
    if (EksOtus.activeDeck==undefined)
        return;
    if (field.name=='trackpad_x') {

    }
    if (field.name=='trackpad_y') {

    }
    if (field.name=='trackpad_left') {

    }
    if (field.name=='trackpad_right') {

    }
    print ("XYPAD group " + field.group + " name " + field.name + " value " + field.value);
}

EksOtus.deckSwitch = function(field) {
    // script.HIDDebug("Processing deck switch event " + field.value);
    if (EksOtus.initialized==false)
        return;

    if (field.value == EksOtus.ButtonStates.released) {
        if (EksOtus.deckSwitchClicked==false) {
            EksOtus.deckSwitchClicked = true;
            EksOtus.deckSwitchClickTimer = engine.beginTimer(
                250,"EksOtus.deckSwitchClickedClear()"
            );
        } else {
            EksOtus.deckSwitchDoubleClick();
        }
    }
    // TODO - add code for 'hold deck_switch and press
    // hot_cue[1-4] to select deck 1-4
}


// Timer to clear the double click status for deck switch
EksOtus.deckSwitchClickedClear = function() {
    // script.HIDDebug("Clearing deck switch timer");
    EksOtus.deckSwitchClicked = false;
    if (EksOtus.deckSwitchClickTimer!=undefined) {
        engine.stopTimer(EksOtus.deckSwitchClickTimer);
        EksOtus.deckSwitchClickTimer = undefined;
    }
}

// Function to handle case when 'deck_switch' button was double clicked
EksOtus.deckSwitchDoubleClick = function() {
    EksOtus.deckSwitchClicked = false;
    if (EksOtus.deckSwitchClickTimer!=undefined) {
        engine.stopTimer(EksOtus.deckSwitchClickTimer);
        EksOtus.deckSwitchClickTimer = undefined;
    }
    switch (EksOtus.activeDeck) {
        case 1:
            EksOtus.activeDeck = 2;
            EksOtus.setLED('deck','deck_switch','green');
            break;
        case 2:
            EksOtus.activeDeck = 1;
            EksOtus.setLED('deck','deck_switch','red');
            break;
        case 3:
            EksOtus.activeDeck = 4;
            EksOtus.setLED('deck','deck_switch','green');
            break;
        case 4:
            EksOtus.activeDeck = 3;
            EksOtus.setLED('deck','deck_switch','red');
            break;
        case undefined:
            EksOtus.activeDeck = 1;
            EksOtus.setLED('deck','deck_switch','red');
            break;
    }
    script.HIDDebug('Active EKS Otus deck now ' + EksOtus.activeDeck);
}

// Otus specific output packet to request device firmware version
EksOtus.requestFirmwareVersion = function() {
    var packet = EksOtus.getOutputPacket('request_firmware_version');
    if (packet==undefined) {
        script.HIDDebug("Output not registered: request_firmware_version");
        return;
    }
    script.HIDDebug("Requesting firmware version " + packet.name);
    packet.send();
}

// Otus specific output packet to set the trackpad control mode
EksOtus.setTrackpadMode = function(mode) {
    if (mode!=0 && mode!=1) {
        script.HIDDebug("Unsupported trackpad mode value: " + mode);
        return;
    }
    var packet = EksOtus.getOutputPacket('set_trackpad_mode');
    if (packet==undefined) {
        script.HIDDebug("Output not registered: set_trackpad_mode");
        return;
    }
    var field = packet.getField('hid','mode');
    if (field==undefined) {
        script.HIDDebug("EksOtus.setTrackpadMode error fetching field mode");
        return;
    }
    field.value = mode;
    packet.send();
}

// Set LED Control Mode on Otus firmware versions > 1.6. Major and minor must
// contain the version numbers for firmware as received from response.
// Valid modes are:
//      0   disable all LEDs
//      1   Re-enable LEDs
//      2   Revert to built-in light functionality
EksOtus.setLEDControlMode = function(mode) {
    if (EksOtus.version_major<=1 && EksOtus.version_minor<6) {
        // Firmware version does not support LED Control Mode Setting
        return;
    }
    if (mode!=0 && mode!=1 && mode!=2) {
        script.HIDDebug("Unknown value for LED Control Mode Setting: " + mode);
        return;
    }
    var packet = EksOtus.OutputPackets['set_ledcontrol_mode'];

    var field = packet.getField('hid','mode');
    if (field==undefined) {
        script.HIDDebug("EksOtus.setLEDControlMode error fetching field mode");
        return;
    }
    field.value = mode;
    packet.send();
}

// Silly little function for wheel LEDs to indicate device is initialized
// Triggers itself with a timer to reverse the LED states to off.
EksOtus.initWheelAnimation = function (state) {
    var i;
    var name = undefined;
    if (state=='off') {
        for (i=EksOtus.WheelLEDCount;i>0;i--) {
            name = 'wheel_' + i;
            EksOtus.setLED('deck',name,state);
        }
        if (EksOtus.initAnimationTimer!=undefined)
            engine.stopTimer(EksOtus.initAnimationTimer);
        EksOtus.initAnimationTimer = undefined;
    } else {
        for (i=1;i<=EksOtus.WheelLEDCount;i++) {
            name = 'wheel_' + i;
            EksOtus.setLED('deck',name,state);
        }
        EksOtus.initAnimationTimer = engine.beginTimer(
            500,
            "EksOtus.initWheelAnimation('off')"
        );
    }
}

EksOtus.TrackpadModeResponse = function(packet,delta) {
    field = packet.getField('hid','status');
    if (field==undefined) {
        script.HIDDebug("Error parsing field status from packet");
        return;
    }
    if (field.value==1) {
        script.HIDDebug("Trackpad mode successfully set");
    } else {
        script.HIDDebug("Trackpad mode change failed");
    }
}

EksOtus.FirmwareVersionResponse = function(packet,delta) {
    script.HIDDebug("Processing firmware version response packet");
    var field_major = packet.getField('hid','major');
    var field_minor = packet.getField('hid','minor');
    if (field_major==undefined) {
        script.HIDDebug("Error parsing field major from packet");
        return;
    }
    if (field_minor==undefined) {
        script.HIDDebug("Error parsing field minor from packet");
        return;
    }
    EksOtus.initialized=true;
    EksOtus.version_major = field_major.value;
    EksOtus.version_minor = field_minor.value;
    EksOtus.setLEDControlMode(1);
    EksOtus.updateLEDs(false);

    // Start blinking 'deck switch' button to indicate we are ready.
    EksOtus.setLEDBlink('deck','deck_switch','amber');

    // Indicate we are initialized with a little animation
    // EksOtus.initWheelAnimation('amber');

    script.HIDDebug("EKS " + EksOtus.id +
        " v"+EksOtus.version_major+"."+EksOtus.version_minor+
        " initialized"
    );
}
