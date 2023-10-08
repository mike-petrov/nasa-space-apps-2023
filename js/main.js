(function () {
  "use strict";

  function SickSlider(sliderElementSelector) {
    var that = {
      // A function that will be called when user changes the slider position.
      // The function will be passed the slider position: a number between 0 and 1.
      onSliderChange: null,
      // Store the previous slider value in order to prevent calling onSliderChange function with the same argument
      previousSliderValue: -42,
      didRequestUpdateOnNextFrame: false
    };

    // Initializes the slider element
    //
    // Arguments:
    //   sliderElementSelector: A CSS selector of the SickSlider element.
    that.init = function (sliderElementSelector) {
      that.slider = document.querySelector(sliderElementSelector);
      that.sliderHead = that.slider.querySelector(".SickSlider-head");
      var sliding = false;

      // Start dragging slider
      // -----------------

      that.slider.addEventListener("mousedown", function (e) {
        sliding = true;
        that.updateHeadPositionOnTouch(e);
      });

      that.slider.addEventListener("touchstart", function (e) {
        sliding = true;
        that.updateHeadPositionOnTouch(e);
      });

      that.slider.onselectstart = function () {
        return false;
      };

      // End dragging slider
      // -----------------

      document.addEventListener("mouseup", function () {
        sliding = false;
      });

      document.addEventListener("dragend", function () {
        sliding = false;
      });

      document.addEventListener("touchend", function (e) {
        sliding = false;
      });

      // Drag slider
      // -----------------

      document.addEventListener("mousemove", function (e) {
        if (!sliding) {
          return;
        }
        that.updateHeadPositionOnTouch(e);
      });

      document.addEventListener("touchmove", function (e) {
        if (!sliding) {
          return;
        }
        that.updateHeadPositionOnTouch(e);
      });

      that.slider.addEventListener("touchmove", function (e) {
        if (typeof e.preventDefault !== 'undefined' && e.preventDefault !== null) {
          e.preventDefault(); // Prevent screen from sliding on touch devices when the element is dragged.
        }
      });
    };

    // Returns the slider value (a number form 0 to 1) from the cursor position
    //
    // Arguments:
    //
    //   e: a touch event.
    //
    that.sliderValueFromCursor = function (e) {
      var pointerX = e.pageX;

      if (e.touches && e.touches.length > 0) {
        pointerX = e.touches[0].pageX;
      }

      pointerX = pointerX - that.slider.offsetLeft;
      var headLeft = (pointerX - 16);
      if (headLeft < 0) {
        headLeft = 0;
      }

      if ((headLeft + that.sliderHead.offsetWidth) > that.slider.offsetWidth) {
        headLeft = that.slider.offsetWidth - that.sliderHead.offsetWidth;
      }

      // Calculate slider value from head position
      var sliderWidthWithoutHead = that.slider.offsetWidth - that.sliderHead.offsetWidth;
      var sliderValue = 1;

      if (sliderWidthWithoutHead !== 0) {
        sliderValue = headLeft / sliderWidthWithoutHead;
      }

      return sliderValue;
    };


    // Changes the position of the slider
    //
    // Arguments:
    //
    //   sliderValue: a value between 0 and 1.
    //
    that.changePosition = function (sliderValue) {
      var headLeft = (that.slider.offsetWidth - that.sliderHead.offsetWidth) * sliderValue;
      that.sliderHead.style.left = headLeft + "px";
    };

    // Update the slider position and call the callback function
    //
    // Arguments:
    //
    //   e: a touch event.
    //
    that.updateHeadPositionOnTouch = function (e) {
      var sliderValue = that.sliderValueFromCursor(e);

      // Handle the head change only if it changed significantly (more than 0.1%)
      if (Math.round(that.previousSliderValue * 10000) === Math.round(sliderValue * 10000)) {
        return;
      }
      that.previousSliderValue = sliderValue;

      if (!that.didRequestUpdateOnNextFrame) {
        // Update the slider on next redraw, to improve performance
        that.didRequestUpdateOnNextFrame = true;
        window.requestAnimationFrame(that.updateOnFrame);
      }
    };

    that.updateOnFrame = function () {
      that.changePosition(that.previousSliderValue);

      if (that.onSliderChange) {
        that.onSliderChange(that.previousSliderValue);
      }

      that.didRequestUpdateOnNextFrame = false;
    };

    that.init(sliderElementSelector);

    return that;
  }

  // Runge-Kutta numerical integration
  var rungeKutta = (function () {
    // h: timestep
    // u: variables
    // derivative: function that calculates the derivatives
    function calculate(h, u, derivative) {
      var a = [h / 2, h / 2, h, 0];
      var b = [h / 6, h / 3, h / 3, h / 6];
      var u0 = [];
      var ut = [];
      var dimension = u.length;

      for (var i = 0; i < dimension; i++) {
        u0.push(u[i]);
        ut.push(0);
      }

      for (var j = 0; j < 4; j++) {
        var du = derivative();

        for (i = 0; i < dimension; i++) {
          u[i] = u0[i] + a[j] * du[i];
          ut[i] = ut[i] + b[j] * du[i];
        }
      }

      for (i = 0; i < dimension; i++) {
        u[i] = u0[i] + ut[i];
      }
    }

    return {
      calculate: calculate
    };
  })();

  // Calculates the simulation of the three bodies
  var physics = (function () {
    var constants = {
      gravitationalConstant: 6.67408 * Math.pow(10, -11),
      // Average density of the body (kg/m^3). Used for calculating body's radius form its mass
      averageDensity: 1410
    };

    // Current state of the system
    var state = {
      // State variables used in the differential equations
      // First two elements are x and y positions, and second two are x and y components of velocity
      // repeated for three bodies.
      u: [
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]
    };

    // Initial condition of the model. The conditions are loaded from the currently selected simulation.
    var initialConditions = {
      bodies: 4, // Number of bodies
    };

    // Calculate the radius of the body (in meters) based on its mass.
    function calculateRadiusFromMass(mass, density) {
      return Math.pow(3 / 4 * mass / (Math.PI * density), 1 / 3);
    }

    // Returns the diameters of three bodies in meters
    function calculateDiameters() {
      var diameters = [];

      // Loop through the bodies
      for (var iBody = 0; iBody < initialConditions.bodies; iBody++) {
        if (initialConditions.densities !== undefined && initialConditions.densities.length >= initialConditions.bodies - 1) {
          var density = initialConditions.densities[iBody];
        } else {
          density = constants.averageDensity;
        }

        diameters.push(2 * calculateRadiusFromMass(initialConditions.masses[iBody], density));
      }

      return diameters;
    }

    function calculateCenterOfMassVelocity() {
      var centerOfMassVelocity = {
        x: 0,
        y: 0
      };
      var sumOfMasses = 0;

      // Loop through the bodies
      for (var iBody = 0; iBody < initialConditions.bodies; iBody++) {
        var bodyStart = iBody * 4; // Starting index for current body in the u array
        centerOfMassVelocity.x += initialConditions.masses[iBody] * state.u[bodyStart + 2];
        centerOfMassVelocity.y += initialConditions.masses[iBody] * state.u[bodyStart + 3];
        sumOfMasses += initialConditions.masses[iBody];
      }

      centerOfMassVelocity.x /= sumOfMasses;
      centerOfMassVelocity.y /= sumOfMasses;

      return centerOfMassVelocity;
    }

    function calculateCenterOfMass() {
      var centerOfMass = {
        x: 0,
        y: 0
      };
      var sumOfMasses = 0;

      // Loop through the bodies
      for (var iBody = 0; iBody < initialConditions.bodies; iBody++) {
        var bodyStart = iBody * 4; // Starting index for current body in the u array
        centerOfMass.x += initialConditions.masses[iBody] * state.u[bodyStart + 0];
        centerOfMass.y += initialConditions.masses[iBody] * state.u[bodyStart + 1];
        sumOfMasses += initialConditions.masses[iBody];
      }

      centerOfMass.x /= sumOfMasses;
      centerOfMass.y /= sumOfMasses;

      return centerOfMass;
    }

    function resetStateToInitialConditions() {
      var iBody, bodyStart;

      // Loop through the bodies
      for (iBody = 0; iBody < initialConditions.bodies; iBody++) {
        bodyStart = iBody * 4; // Starting index for current body in the u array

        var position = initialConditions.positions[iBody];
        state.u[bodyStart + 0] = position.r * Math.cos(position.theta); // x
        state.u[bodyStart + 1] = position.r * Math.sin(position.theta); //y

        var velocity = initialConditions.velocities[iBody];
        state.u[bodyStart + 2] = velocity.r * Math.cos(velocity.theta); // velocity x
        state.u[bodyStart + 3] = velocity.r * Math.sin(velocity.theta); // velocity y
      }

      var centerOfMassVelocity = calculateCenterOfMassVelocity();
      var centerOfMass = calculateCenterOfMass();

      // Correct the velocities and positions of the bodies
      // to make the center of mass motionless at the middle of the screen
      for (iBody = 0; iBody < initialConditions.bodies; iBody++) {
        bodyStart = iBody * 4; // Starting index for current body in the u array
        state.u[bodyStart + 0] -= centerOfMass.x;
        state.u[bodyStart + 1] -= centerOfMass.y;
        state.u[bodyStart + 2] -= centerOfMassVelocity.x;
        state.u[bodyStart + 3] -= centerOfMassVelocity.y;
      }
    }

    // Calculates the acceleration of the body 'iFromBody'
    // due to gravity from other bodies,
    // using Newton's law of gravitation.
    //   iFromBody: the index of body. 0 is first body, 1 is second body.
    //   coordinate: 0 for x coordinate, 1 for y coordinate
    function acceleration(iFromBody, coordinate) {
      var result = 0;
      var iFromBodyStart = iFromBody * 4; // Starting index for the body in the u array

      // Loop through the bodies
      for (var iToBody = 0; iToBody < initialConditions.bodies; iToBody++) {
        if (iFromBody === iToBody) {
          continue;
        }
        var iToBodyStart = iToBody * 4; // Starting index for the body in the u array

        // Distance between the two bodies
        var distanceX = state.u[iToBodyStart + 0] -
          state.u[iFromBodyStart + 0];

        var distanceY = state.u[iToBodyStart + 1] -
          state.u[iFromBodyStart + 1];

        var distance = Math.sqrt(Math.pow(distanceX, 2) + Math.pow(distanceY, 2));
        var gravitationalConstant = 1;

        if (initialConditions.dimensionless !== true) {
          gravitationalConstant = constants.gravitationalConstant;
        }

        result += gravitationalConstant *
          initialConditions.masses[iToBody] *
          (state.u[iToBodyStart + coordinate] - state.u[iFromBodyStart + coordinate]) /
          (Math.pow(distance, 3));
      }

      return result;
    }

    // Calculate the derivatives of the system of ODEs that describe equation of motion of the bodies
    function derivative() {
      var du = new Array(initialConditions.bodies * 4);

      // Loop through the bodies
      for (var iBody = 0; iBody < initialConditions.bodies; iBody++) {
        // Starting index for current body in the u array
        var bodyStart = iBody * 4;

        du[bodyStart + 0] = state.u[bodyStart + 0 + 2]; // Velocity x
        du[bodyStart + 1] = state.u[bodyStart + 0 + 3]; // Velocity y
        du[bodyStart + 2] = acceleration(iBody, 0); // Acceleration x
        du[bodyStart + 3] = acceleration(iBody, 1); // Acceleration y
      }

      return du;
    }

    // The main function that is called on every animation frame.
    // It calculates and updates the current positions of the bodies
    function updatePosition(timestep) {
      rungeKutta.calculate(timestep, state.u, derivative);
    }

    function calculateNewPosition() {
      // Loop through the bodies
      for (var iBody = 0; iBody < initialConditions.bodies; iBody++) {
        var bodyStart = iBody * 4; // Starting index for current body in the u array

        state.positions[iBody].x = state.u[bodyStart + 0];
        state.positions[iBody].y = state.u[bodyStart + 1];
      }
    }

    // Returns the largest distance of an object from the center based on initial considitions
    function largestDistanceMeters() {
      var result = 0;

      // Loop through the bodies
      for (var iBody = 0; iBody < initialConditions.bodies; iBody++) {
        var position = initialConditions.positions[iBody];
        if (result < position.r) {
          result = position.r + 2 * Math.pow(10, 11);
        }
      }
      return result;
    }

    function changeInitialConditions(conditions) {
      initialConditions.dimensionless = conditions.dimensionless;
      initialConditions.masses = conditions.masses.slice();
      initialConditions.positions = conditions.positions;
      initialConditions.velocities = conditions.velocities;
      initialConditions.timeScaleFactor = conditions.timeScaleFactor;
      initialConditions.massSlider = conditions.massSlider;
      initialConditions.timeScaleFactorSlider = conditions.timeScaleFactorSlider;
      initialConditions.densities = conditions.densities;
      initialConditions.paleOrbitalPaths = conditions.paleOrbitalPaths;
    }

    return {
      resetStateToInitialConditions: resetStateToInitialConditions,
      updatePosition: updatePosition,
      calculateNewPosition: calculateNewPosition,
      initialConditions: initialConditions,
      state: state,
      calculateDiameters: calculateDiameters,
      largestDistanceMeters: largestDistanceMeters,
      changeInitialConditions: changeInitialConditions,
      constants: constants
    };
  })();

  // Draw the scene
  var graphics = (function () {
    var canvas = null, // Canvas DOM element.
      context = null, // Canvas context for drawing.
      canvasHeight = 700,
      // The scaling factor used to draw distances between the objects and their sizes
      // Updated automatically on first draw
      metersPerPixel = 100,
      minimumSizePixels = 10, // Minimum size of an object in pixels.
      maximumSizePixels = 80, // Maximum size of an object in pixels.
      colors = {
        orbitalPaths: ["#ffffff", "#1e7a9d", "#5c3010", "#cfcfcf"],
        paleOrbitalPaths: ["#ab681c", "#4957ae", "#359256", "#cfcfcf"]
      },
      // Positions of three bodies in pixels on screen
      bodyPositions = [{
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        }
      ],
      // Previously drawn positions of the two bodies. Used to draw orbital line.
      previousBodyPositions = [{
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        }
      ],
      // Contains the DOM elements of the bodies
      bodyElemenets = [],
      // Body sizes in pixels
      currentBodySizes = [
        10, 10, 10, 10
      ],
      middleX = 1,
      middleY = 1;


    function drawBody(position, size, bodyElement) {
      var left = (position.x - size / 2) + 1000;
      var top = (position.y - size / 2) + 1000;
      // Using style.transform instead of style.left, since style.left was
      // noticeably slower on mobile Chrome
      bodyElement.style.transform = "translate(" + left + "px," + top + "px)";
    }

    // Updates the sizes of the objects
    //    sizes: the sizes of objects in meters
    function updateObjectSizes(sizes) {
      // Loop through the bodies
      for (var iBody = 0; iBody < sizes.length; iBody++) {
        currentBodySizes[iBody] = sizes[iBody] / metersPerPixel;

        if (currentBodySizes[iBody] < minimumSizePixels) {
          currentBodySizes[iBody] = minimumSizePixels;
        }

        if (currentBodySizes[iBody] > maximumSizePixels) {
          currentBodySizes[iBody] = maximumSizePixels;
        }

        bodyElemenets[iBody].style.width = currentBodySizes[iBody] + "px";
      }
    }

    function drawOrbitalLine(newPosition, previousPosition, color) {
      if (previousPosition.x === null) {
        previousPosition.x = newPosition.x;
        previousPosition.y = newPosition.y;
        return;
      }

      context.beginPath();
      context.strokeStyle = color;
      context.moveTo(previousPosition.x, previousPosition.y);
      context.lineTo(newPosition.x, newPosition.y);
      context.stroke();

      previousPosition.x = newPosition.x;
      previousPosition.y = newPosition.y;
    }

    // Calculates the new positions of the bodies on screen
    // from the given state variables
    function calculateNewPositions(statePositions) {
      // Loop through the bodies
      for (var iBody = 0; iBody < statePositions.length / 4; iBody++) {
        var bodyStart = iBody * 4; // Starting index for current body in the u array

        var x = statePositions[bodyStart + 0];
        var y = statePositions[bodyStart + 1];

        middleX = Math.floor(canvas.width / 2);
        middleY = Math.floor(canvas.height / 2);
        bodyPositions[iBody].x = x / metersPerPixel + middleX;
        bodyPositions[iBody].y = -y / metersPerPixel + middleY;
      }
    }

    function drawBodies() {
      // Loop through the bodies
      for (var iBody = 0; iBody < bodyPositions.length; iBody++) {
        var bodyPosition = bodyPositions[iBody];
        drawBody(bodyPosition, currentBodySizes[iBody], bodyElemenets[iBody]);
      }
    }

    function drawOrbitalLines(paleOrbitalPaths) {
      // Loop through the bodies
      for (var iBody = 0; iBody < bodyPositions.length; iBody++) {
        var bodyPosition = bodyPositions[iBody];
        var orbitalPathColors = paleOrbitalPaths ? colors.paleOrbitalPaths : colors.orbitalPaths;
        drawOrbitalLine(bodyPosition, previousBodyPositions[iBody], orbitalPathColors[iBody]);
      }
    }

    function showCanvasNotSupportedMessage() {
      document.getElementById("NasaApp-notSupportedMessage").style.display = 'block';
    }

    // Resize canvas to will the width of container
    function fitToContainer() {

      // Adjust the canvas to the size of the screen
      canvasHeight = Math.min(window.innerHeight, window.innerWidth) - 100;
      document.querySelector(".NasaApp-container").style.height = canvasHeight + 'px';

      canvas.style.width = '100%';
      canvas.style.height = canvasHeight + 'px';
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    // Returns true on error and false on success
    function initCanvas() {
      // Find the canvas HTML element
      canvas = document.querySelector(".NasaApp-canvas");

      // Check if the browser supports canvas drawing
      if (!(window.requestAnimationFrame && canvas && canvas.getContext)) {
        return true;
      }

      // Get canvas context for drawing
      context = canvas.getContext("2d");
      if (!context) {
        return true;
      } // Error, browser does not support canvas
      return false;
    }

    // Create canvas for drawing and call success argument
    function init(success) {
      if (initCanvas()) {
        // The browser can not use canvas. Show a warning message.
        showCanvasNotSupportedMessage();
        return;
      }

      // Update the size of the canvas
      fitToContainer();

      var sunElement = document.querySelector(".NasaApp-sun");
      var earthElement = document.querySelector(".NasaApp-earth");
      var marsElement = document.querySelector(".NasaApp-mars");
      var marsCycler = document.querySelector(".NasaApp-marsCycler");

      bodyElemenets = [];
      bodyElemenets.push(sunElement);
      bodyElemenets.push(earthElement);
      bodyElemenets.push(marsElement);
      bodyElemenets.push(marsCycler);

      // Execute success callback function
      success();
    }

    function clearScene(largestDistanceMeters) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      previousBodyPositions = [{
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        },
        {
          x: null,
          y: null
        }
      ];

      // Update the scaling
      metersPerPixel = 2.3 * largestDistanceMeters / Math.min(canvas.offsetWidth, canvas.offsetHeight, window.innerHeight);
    }

    return {
      fitToContainer: fitToContainer,
      drawOrbitalLines: drawOrbitalLines,
      drawBodies: drawBodies,
      updateObjectSizes: updateObjectSizes,
      clearScene: clearScene,
      calculateNewPositions: calculateNewPositions,
      init: init
    };
  })();

  // Start the simulation
  var simulation = (function () {
    // The number of calculations done in one 16 millisecond frame.
    // The higher the number, the more precise are the calculations and the slower the simulation.
    var calculationsPerFrame = 250;

    var framesPerSecond = 60; // Number of frames per second

    // Maximum number of times the orbital lines are drawn per frame.
    // To improve performance, we do not draw after each calculation, since drawing can be slow.
    var drawTimesPerFrame = 10;

    // Used to decide if we need to draw at calculations
    var drawIndex = Math.ceil(calculationsPerFrame / drawTimesPerFrame);

    // The method is called 60 times per second
    function animate() {
      // The time step in seconds used in simulation
      var timestep = physics.initialConditions.timeScaleFactor / framesPerSecond / calculationsPerFrame;

      for (var i = 0; i < calculationsPerFrame; i++) {
        physics.updatePosition(timestep);

        // Decide if we need to draw orbital lines
        if (i % drawIndex === 0) {
          graphics.calculateNewPositions(physics.state.u);
          graphics.drawOrbitalLines(physics.initialConditions.paleOrbitalPaths);
        }
      }

      // Move the modies to new a position. This can be slow, because it
      // updates the position of the DOM elements.
      // Thus, will call it only once per frame.
      graphics.drawBodies();

      window.requestAnimationFrame(animate);
    }

    function start() {
      graphics.init(function () {
        physics.resetStateToInitialConditions();
        graphics.clearScene(physics.largestDistanceMeters());
        graphics.updateObjectSizes(physics.calculateDiameters());

        // Redraw the scene if page is resized
        window.addEventListener('resize', function (event) {
          graphics.fitToContainer();
          graphics.clearScene(physics.largestDistanceMeters());
          graphics.calculateNewPositions(physics.state.u);
          graphics.drawOrbitalLines(physics.initialConditions.paleOrbitalPaths);
          graphics.drawBodies();
        });

        animate();
      });
    }

    return {
      start: start
    };
  })();

  // Helper functions for dealing with CSS
  var cssHelper = (function () {
    function hasClass(element, className) {
      return (' ' + element.className + ' ').indexOf(' ' + className + ' ') > -1;
    }

    function removeClass(element, className) {
      element.className = element.className
        .replace(new RegExp('(?:^|\\s)' + className + '(?:\\s|$)'), ' ');
    }

    function addClass(element, className) {
      if (hasClass(element, className)) return;
      element.className += " " + className;
    }

    return {
      hasClass: hasClass,
      removeClass: removeClass,
      addClass: addClass
    };
  })();

  // The presets for different simulations
  var simulations = (function () {
    var content = {
      didChangeModel: null // function handler that is called when user changes a model
    };

    var allPresets = {
      "MarsCycler": {
        masses: [
          1.98855 * Math.pow(10, 30),
          5.972 * Math.pow(10, 24),
          6.4171 * Math.pow(10, 23),
          4.2 * Math.pow(10, 5),
        ],
        densities: [0.01, 0.01, 0.01, 0.01],
        massSlider: {
          min: 3 * Math.pow(10, 2),
          max: 3 * Math.pow(10, 30),
          power: 5,
        },
        timeScaleFactor: 3600 * 24 * 365,
        timeScaleFactorSlider: {
          min: 0,
          max: 3600 * 24 * 500 * 10000,
          power: 5,
        },
        positions: [ // in Polar coordinates, r is in meters
          {
            r: 0,
            theta: 0,
          },
          {
            r: 1.496 * Math.pow(10, 11),
            theta: 0,
          },
          {
            r: 2.28 * Math.pow(10, 11),
            theta: 0,
          },
          {
            r: 2.29 * Math.pow(10, 11),
            theta: 0.32,
          }
        ],
        velocities: [ // in Polar coordinates, r is in m/s
          {
            r: 0,
            theta: Math.PI / 2,
          },
          {
            r: 30 * Math.pow(10, 3),
            theta: Math.PI / 2,
          },
          {
            r: 24 * Math.pow(10, 3),
            theta: Math.PI / 2,
          },
          {
            r: 24 * Math.pow(10, 3),
            theta: Math.PI / 2,
          }
        ]
      },
    };

    function init() {
      return allPresets.MarsCycler;
    }

    return {
      init: init,
      content: content
    };
  })();

  // A slider maps an input to output values, both between 0 and 1 using an odd power function.
  // The function is constructed such that is not very sensitive at the default output value
  // (for example, the starting value for the mass of an object)
  // but rapidly changes as when the slider is moved far away form it.
  var oddPowerCurve = (function () {
    function calcualteL(defaultOutput, power) {
      if (power === 0) return 1;
      return -Math.pow(defaultOutput, 1 / power);
    }

    function calcualteA(defaultOutput, power) {
      if (power === 0) return 1;
      return Math.pow(1 - defaultOutput, 1 / power) - calcualteL(defaultOutput, power);
    }

    // Return the slider input value based on the output and default output values
    function sliderInputValue(defaultOutput, output, power) {
      if (power === 0) return 1;
      var a = calcualteA(defaultOutput, power);
      if (a === 0) {
        a = 1;
      }
      var l = calcualteL(defaultOutput, power);
      var sign = (output - defaultOutput) < 0 ? -1 : 1;
      return (sign * Math.pow(Math.abs(output - defaultOutput), 1 / power) - l) / a;
    }

    // Return the slider output value based on the input and default output values
    function sliderOutputValue(defaultOutput, intput, power) {
      if (power === 0) return 1;
      var a = calcualteA(defaultOutput, power);
      var l = calcualteL(defaultOutput, power);

      var result = Math.pow(a * intput + l, power) + defaultOutput;
      if (result < 0) {
        result = 0;
      }
      return result;
    }

    return {
      sliderInputValue: sliderInputValue,
      sliderOutputValue: sliderOutputValue
    };
  })();

  // React to user input
  var userInput = (function () {
    var spinElements = document.querySelectorAll(".NasaApp-spin");
    var sliderLabelElement = document.querySelector(".NasaApp-sliderLabel");
    var restartButton = document.querySelector(".NasaApp-reload");
    var shuttleButton = document.querySelector(".NasaApp-shuttleButton");
    var speedButton = document.querySelector(".NasaApp-speedButton");
    var sliderElement = document.querySelector(".NasaApp-slider");
    var slider;
    var currentSlider = "Speed";
    var currentMassSliderIndex = 0;
    var currentModel; // Currently selected model

    // Returns the output value of the slider between 0 to 1 corresponding to the
    // default value of the variable (such as default mass for an object)
    function calculateDefaultSliderOutput(sliderSettings) {
      var defaultValue = getCurrentSimulationValue(currentModel);
      return (defaultValue - sliderSettings.min) / (sliderSettings.max - sliderSettings.min);
    }

    function didUpdateSlider(sliderValue) {
      var sliderText;
      var sliderSettings = getCurrentSliderSettings();


      if (sliderSettings.power !== undefined) {

        if (sliderSettings.power % 2 === 1) { // Odd power
          var defaultOutput = calculateDefaultSliderOutput(sliderSettings);
          sliderValue = oddPowerCurve.sliderOutputValue(defaultOutput, sliderValue, sliderSettings.power);
        } else {
          sliderValue = Math.pow(sliderValue, sliderSettings.power);
        }
      }

      var newValue = sliderSettings.min + (sliderSettings.max - sliderSettings.min) * sliderValue;
      newValue = roundSliderValue(newValue);

      if (currentSlider === "mass") {
        physics.initialConditions.masses[currentMassSliderIndex] = newValue;
        graphics.updateObjectSizes(physics.calculateDiameters());
        sliderText = formatMassForSlider(newValue);
      } else {
        physics.initialConditions.timeScaleFactor = newValue;
        sliderText = formatTimescaleForSlider(newValue);

        if (newValue === 0) {
          spinElements[0].style.animationDuration = `0s`;
          spinElements[1].style.animationDuration = `0s`;
          spinElements[2].style.animationDuration = `0s`;
        } else {
          spinElements[0].style.animationDuration = `0.5s`;
          spinElements[1].style.animationDuration = `0.5s`;
          spinElements[2].style.animationDuration = `0.5s`;
        }
      }

      sliderLabelElement.innerText = sliderText;
    }

    function getCurrentSliderSettings() {
      var sliderSettings;

      if (currentSlider === "mass") {
        sliderSettings = physics.initialConditions.massSlider;
      } else {
        sliderSettings = physics.initialConditions.timeScaleFactorSlider;
      }

      return sliderSettings;
    }

    function roundSliderValue(value) {
      return Math.round(value * 10000) / 10000;
    }

    function roundSliderValueText(value) {
      return parseFloat(Math.round(value * 10000) / 10000).toFixed(4);
    }

    function bodyNameFromIndex(index) {
      switch (index) {
        case 0:
          return "the Sun";
        case 1:
          return "the Earth";
        case 2:
          return "Mars";
        default:
          return "Cycler";
      }
    }

    function formatMassForSlider(mass) {
      var formatted = roundSliderValueText(mass);

      if (mass > 10000) {
        formatted = mass.toExponential(4);
      }

      formatted = "Mass of " + bodyNameFromIndex(currentMassSliderIndex) + " : " + formatted;

      if (physics.initialConditions.dimensionless !== true) {
        formatted += " kg";
      }

      return formatted;
    }

    function formatTimescaleForSlider(value) {
      var timeHumanized = timeHumanReadable(value);
      var formatted = roundSliderValueText(timeHumanized.value);

      if (timeHumanized.value > 10000) {
        formatted = timeHumanized.value.toExponential(2);
      }

      formatted = "Speed: " + formatted + " " + timeHumanized.unit + " per second";

      return formatted;
    }

    function timeHumanReadable(time) {
      var result = {
        unit: 'second',
        value: time
      };

      if (result.value < 60) {
        return result;
      }

      result.value /= 60;
      result.unit = 'minute';

      if (result.value < 60) {
        return result;
      }

      result.value /= 60;
      result.unit = 'hour';

      if (result.value < 24) {
        return result;
      }

      result.value /= 24;
      result.unit = 'day';

      if (result.value < 365) {
        return result;
      }

      result.value /= 365;
      result.unit = 'year';

      if (result.value < 100) {
        return result;
      }

      result.value /= 100;
      result.unit = 'century';

      return result;
    }

    function didClickRestart() {
      physics.resetStateToInitialConditions();
      graphics.clearScene(physics.largestDistanceMeters());
      graphics.updateObjectSizes(physics.calculateDiameters());
      return false; // Prevent default
    }

    function getCurrentSimulationValue(model) {
      var simulationValue;
      if (currentSlider === "mass") {
        simulationValue = model.masses[currentMassSliderIndex];
      } else {
        simulationValue = model.timeScaleFactor;
      }
      return simulationValue;
    }

    function resetSlider() {
      cssHelper.removeClass(sliderElement, "NasaApp-sliderSun");
      cssHelper.removeClass(sliderElement, "NasaApp-sliderEarth");
      cssHelper.removeClass(sliderElement, "NasaApp-sliderMars");
      cssHelper.removeClass(sliderElement, "NasaApp-sliderMarsCycler");

      var sliderSettings = getCurrentSliderSettings();
      var simulationValue = getCurrentSimulationValue(physics.initialConditions);
      var sliderText;

      if (currentSlider === "mass") {
        sliderText = formatMassForSlider(physics.initialConditions.masses[currentMassSliderIndex]);

        switch (currentMassSliderIndex) {
          case 0:
            cssHelper.addClass(sliderElement, "NasaApp-sliderSun");
            break;
          case 1:
            cssHelper.addClass(sliderElement, "NasaApp-sliderEarth");
            break;
          case 2:
            cssHelper.addClass(sliderElement, "NasaApp-sliderMars");
            break;
          default:
            cssHelper.addClass(sliderElement, "NasaApp-sliderMarsCycler");
        }
      } else {
        sliderText = formatTimescaleForSlider(physics.initialConditions.timeScaleFactor);
      }

      sliderLabelElement.innerText = sliderText;
      var sliderPosition = (simulationValue - sliderSettings.min) / (sliderSettings.max - sliderSettings.min);

      if (sliderSettings.power !== undefined) {
        if (sliderSettings.power % 2 === 1) { // Odd power
          var defaultOutput = calculateDefaultSliderOutput(sliderSettings);
          sliderPosition = oddPowerCurve.sliderInputValue(defaultOutput, sliderPosition, sliderSettings.power);
        } else {
          sliderPosition = Math.pow(sliderPosition, 1 / sliderSettings.power);
        }
      }

      slider.changePosition(sliderPosition);
    }

    function didChangeModel(model) {
      currentModel = model;
      physics.changeInitialConditions(currentModel);
      didClickRestart();
      resetSlider();
    }

    function didClickShuttle() {
      currentSlider = "mass";
      currentMassSliderIndex = 3;
      resetSlider();
      return false; // Prevent default
    }

    function didClickSpeed() {
      currentSlider = "speed";
      currentMassSliderIndex = 0;
      resetSlider();
      return false; // Prevent default
    }

    function init() {
      currentModel = simulations.init();
      physics.changeInitialConditions(currentModel);
      simulations.content.didChangeModel = didChangeModel;

      // Slider
      slider = SickSlider(".NasaApp-slider");
      slider.onSliderChange = didUpdateSlider;
      resetSlider();

      // Buttons
      restartButton.onclick = didClickRestart;
      shuttleButton.onclick = didClickShuttle;
      speedButton.onclick = didClickSpeed;
    }

    return {
      init: init
    };
  })();

  userInput.init();

  simulation.start();
})();
