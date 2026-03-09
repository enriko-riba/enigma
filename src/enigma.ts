/*
Example:

const machine = createEnigmaMachine(
  {
    rotors: ["I", "II", "III"],
    positions: ["A", "A", "A"],
    reflector: "B",
    plugboardPairs: ["AB", "CD", "EF"],
  },
  {
    onEvent: (event) => {
      console.log(event);
    },
  },
);

console.log(encipherEnigma(machine, "HELLO"));
console.log(encipherEnigma(machine, " WORLD"));
*/

export type RotorName = "I" | "II" | "III";
export type ReflectorName = "B";
export type PositionTuple = [string, string, string];

export type EnigmaConfig = {
    rotors: [RotorName, RotorName, RotorName]; // [left, middle, right]
    positions: PositionTuple; // e.g. ["A", "A", "A"]
    reflector: ReflectorName; // only "B" supported
    plugboardPairs?: string[]; // e.g. ["AB", "CD", "EF"]
};

type RotorSpec = {
    wiring: string;
    notch: string;
};

type RotorState = {
    wiring: number[];
    reverseWiring: number[];
    notch: number;
    position: number;
};

type NotchTurnover = {
    turnoverRotor: "I" | "II";
    movedRotor: "II" | "III";
};

export type EnigmaSignalStage =
    | "keyboard"
    | "plugboard-entry"
    | "rotor-right-forward"
    | "rotor-middle-forward"
    | "rotor-left-forward"
    | "reflector"
    | "rotor-left-reverse"
    | "rotor-middle-reverse"
    | "rotor-right-reverse"
    | "plugboard-exit"
    | "lampboard";

export type EnigmaEvent =
    | {
          type: "configured";
          config: EnigmaConfig;
          rotorPositions: PositionTuple;
      }
    | {
          type: "rotor-positions-changed";
          before: PositionTuple;
          after: PositionTuple;
      }
    | {
          type: "rotor-notch-turnover";
          turnoverRotor: "I" | "II";
          movedRotor: "II" | "III";
          turnoverRotorName: RotorName;
          movedRotorName: RotorName;
          rotorPositionsBeforeStep: PositionTuple;
          rotorPositionsAfterStep: PositionTuple;
          movedRotorPositionBefore: string;
          movedRotorPositionAfter: string;
      }
    | {
          type: "signal-step";
          stage: EnigmaSignalStage;
          input: string;
          output: string;
          rotorPositions: PositionTuple;
          rotorSide?: "left" | "middle" | "right";
          rotorName?: RotorName;
      }
    | {
          type: "character-encoded";
          input: string;
          output: string;
          rotorPositionsBeforeStep: PositionTuple;
          rotorPositionsAfterStep: PositionTuple;
      }
    | {
          type: "non-letter-passthrough";
          input: string;
          rotorPositions: PositionTuple;
      }
    | {
          type: "reset";
          rotorPositions: PositionTuple;
      };

export type EnigmaEventListener = (event: EnigmaEvent) => void;

export type CreateEnigmaMachineOptions = {
    onEvent?: EnigmaEventListener;
};

export type EnigmaMachine = {
    encipher: (input: string) => string;
    getRotorPositions: () => PositionTuple;
    reset: (positions?: PositionTuple) => void;
    onEvent: (listener: EnigmaEventListener) => () => void;
};

const ROTOR_SPECS: Record<RotorName, RotorSpec> = {
    I: { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
    II: { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
    III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
};

const REFLECTORS: Record<ReflectorName, string> = {
    B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
};

export function createEnigmaMachine(
    config: EnigmaConfig,
    options: CreateEnigmaMachineOptions = {},
): EnigmaMachine {
    validateConfig(config);

    const normalizedConfig = normalizeConfig(config);
    const listeners = new Set<EnigmaEventListener>();

    if (options.onEvent) {
        listeners.add(options.onEvent);
    }

    const emit = (event: EnigmaEvent): void => {
        for (const listener of listeners) {
            listener(event);
        }
    };

    const left = createRotor(normalizedConfig.rotors[0], normalizedConfig.positions[0]);
    const middle = createRotor(normalizedConfig.rotors[1], normalizedConfig.positions[1]);
    const right = createRotor(normalizedConfig.rotors[2], normalizedConfig.positions[2]);

    const reflector = toIndexMap(REFLECTORS[normalizedConfig.reflector]);
    const plugboard = createPlugboard(normalizedConfig.plugboardPairs ?? []);

    const getRotorPositions = (): PositionTuple => [
        indexToChar(left.position),
        indexToChar(middle.position),
        indexToChar(right.position),
    ];

    const setPositions = (positions: PositionTuple): void => {
        validatePosition(positions[0]);
        validatePosition(positions[1]);
        validatePosition(positions[2]);

        left.position = charToIndex(positions[0].toUpperCase());
        middle.position = charToIndex(positions[1].toUpperCase());
        right.position = charToIndex(positions[2].toUpperCase());
    };

    const emitSignalStep = (
        stage: EnigmaSignalStage,
        inputIndex: number,
        outputIndex: number,
        rotorPositions: PositionTuple,
        rotorSide?: "left" | "middle" | "right",
        rotorName?: RotorName,
    ): void => {
        emit({
            type: "signal-step",
            stage,
            input: indexToChar(inputIndex),
            output: indexToChar(outputIndex),
            rotorPositions,
            rotorSide,
            rotorName,
        });
    };

    const encipher = (input: string): string => {
        let output = "";

        for (const rawChar of input.toUpperCase()) {
            if (!isLetter(rawChar)) {
                emit({
                    type: "non-letter-passthrough",
                    input: rawChar,
                    rotorPositions: getRotorPositions(),
                });
                output += rawChar;
                continue;
            }

            const beforeStep = getRotorPositions();
            const notchTurnovers = stepRotors(left, middle, right);
            const afterStep = getRotorPositions();

            emit({
                type: "rotor-positions-changed",
                before: beforeStep,
                after: afterStep,
            });

            for (const turnover of notchTurnovers) {
                const turnoverRotorIndex = rotorSlotToTupleIndex(turnover.turnoverRotor);
                const movedRotorIndex = rotorSlotToTupleIndex(turnover.movedRotor);
                emit({
                    type: "rotor-notch-turnover",
                    turnoverRotor: turnover.turnoverRotor,
                    movedRotor: turnover.movedRotor,
                    turnoverRotorName: normalizedConfig.rotors[turnoverRotorIndex],
                    movedRotorName: normalizedConfig.rotors[movedRotorIndex],
                    rotorPositionsBeforeStep: beforeStep,
                    rotorPositionsAfterStep: afterStep,
                    movedRotorPositionBefore: beforeStep[movedRotorIndex],
                    movedRotorPositionAfter: afterStep[movedRotorIndex],
                });
            }

            let c = charToIndex(rawChar);

            emitSignalStep("keyboard", c, c, afterStep);

            let previous = c;
            c = plugboard[c];
            emitSignalStep("plugboard-entry", previous, c, afterStep);

            previous = c;
            c = encodeForward(right, c);
            emitSignalStep(
                "rotor-right-forward",
                previous,
                c,
                afterStep,
                "right",
                normalizedConfig.rotors[2],
            );

            previous = c;
            c = encodeForward(middle, c);
            emitSignalStep(
                "rotor-middle-forward",
                previous,
                c,
                afterStep,
                "middle",
                normalizedConfig.rotors[1],
            );

            previous = c;
            c = encodeForward(left, c);
            emitSignalStep(
                "rotor-left-forward",
                previous,
                c,
                afterStep,
                "left",
                normalizedConfig.rotors[0],
            );

            previous = c;
            c = reflector[c];
            emitSignalStep("reflector", previous, c, afterStep);

            previous = c;
            c = encodeBackward(left, c);
            emitSignalStep(
                "rotor-left-reverse",
                previous,
                c,
                afterStep,
                "left",
                normalizedConfig.rotors[0],
            );

            previous = c;
            c = encodeBackward(middle, c);
            emitSignalStep(
                "rotor-middle-reverse",
                previous,
                c,
                afterStep,
                "middle",
                normalizedConfig.rotors[1],
            );

            previous = c;
            c = encodeBackward(right, c);
            emitSignalStep(
                "rotor-right-reverse",
                previous,
                c,
                afterStep,
                "right",
                normalizedConfig.rotors[2],
            );

            previous = c;
            c = plugboard[c];
            emitSignalStep("plugboard-exit", previous, c, afterStep);

            emitSignalStep("lampboard", c, c, afterStep);

            const outputChar = indexToChar(c);
            emit({
                type: "character-encoded",
                input: rawChar,
                output: outputChar,
                rotorPositionsBeforeStep: beforeStep,
                rotorPositionsAfterStep: afterStep,
            });

            output += outputChar;
        }

        return output;
    };

    const machine: EnigmaMachine = {
        encipher,
        getRotorPositions,
        reset: (positions: PositionTuple = normalizedConfig.positions) => {
            setPositions(positions);
            emit({
                type: "reset",
                rotorPositions: getRotorPositions(),
            });
        },
        onEvent: (listener: EnigmaEventListener): (() => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };

    emit({
        type: "configured",
        config: cloneConfig(normalizedConfig),
        rotorPositions: getRotorPositions(),
    });

    return machine;
}

export function encipherEnigma(config: EnigmaConfig, input: string): string;
export function encipherEnigma(machine: EnigmaMachine, input: string): string;
export function encipherEnigma(
    configOrMachine: EnigmaConfig | EnigmaMachine,
    input: string,
): string {
    if ("encipher" in configOrMachine) {
        return configOrMachine.encipher(input);
    }

    return createEnigmaMachine(configOrMachine).encipher(input);
}

function normalizeConfig(config: EnigmaConfig): EnigmaConfig {
    return {
        rotors: [config.rotors[0], config.rotors[1], config.rotors[2]],
        positions: [
            config.positions[0].toUpperCase(),
            config.positions[1].toUpperCase(),
            config.positions[2].toUpperCase(),
        ],
        reflector: config.reflector,
        plugboardPairs: (config.plugboardPairs ?? []).map((pair) => pair.toUpperCase()),
    };
}

function cloneConfig(config: EnigmaConfig): EnigmaConfig {
    return {
        rotors: [config.rotors[0], config.rotors[1], config.rotors[2]],
        positions: [config.positions[0], config.positions[1], config.positions[2]],
        reflector: config.reflector,
        plugboardPairs: [...(config.plugboardPairs ?? [])],
    };
}

function validateConfig(config: EnigmaConfig): void {
    if (config.reflector !== "B") {
        throw new Error(`Unsupported reflector: ${config.reflector}`);
    }

    if (new Set(config.rotors).size !== 3) {
        throw new Error("Rotors must be unique, e.g. ['I', 'II', 'III'].");
    }

    validatePosition(config.positions[0]);
    validatePosition(config.positions[1]);
    validatePosition(config.positions[2]);

    const used = new Set<string>();
    for (const pair of config.plugboardPairs ?? []) {
        const normalized = pair.toUpperCase();
        if (!/^[A-Z]{2}$/.test(normalized) || normalized[0] === normalized[1]) {
            throw new Error(`Invalid plugboard pair: ${pair}`);
        }

        for (const ch of normalized) {
            if (used.has(ch)) {
                throw new Error(`Plugboard letter used more than once: ${ch}`);
            }
            used.add(ch);
        }
    }
}

function validatePosition(position: string): void {
    if (position.length !== 1 || !isLetter(position.toUpperCase())) {
        throw new Error(`Invalid rotor position: ${position}`);
    }
}

function createRotor(name: RotorName, position: string): RotorState {
    const spec = ROTOR_SPECS[name];
    const wiring = toIndexMap(spec.wiring);
    const reverseWiring = invertMap(wiring);

    return {
        wiring,
        reverseWiring,
        notch: charToIndex(spec.notch),
        position: charToIndex(position.toUpperCase()),
    };
}

function createPlugboard(pairs: string[]): number[] {
    const map = identityMap();

    for (const pair of pairs) {
        const a = charToIndex(pair[0].toUpperCase());
        const b = charToIndex(pair[1].toUpperCase());
        map[a] = b;
        map[b] = a;
    }

    return map;
}

function stepRotors(left: RotorState, middle: RotorState, right: RotorState): NotchTurnover[] {
    const middleAtNotch = atNotch(middle);
    const rightAtNotch = atNotch(right);
    const turnovers: NotchTurnover[] = [];

    if (rightAtNotch) {
        turnovers.push({
            turnoverRotor: "I",
            movedRotor: "II",
        });
    }

    if (middleAtNotch) {
        turnovers.push({
            turnoverRotor: "II",
            movedRotor: "III",
        });
    }

    if (middleAtNotch) {
        left.position = mod26(left.position + 1);
    }

    if (rightAtNotch || middleAtNotch) {
        middle.position = mod26(middle.position + 1);
    }

    right.position = mod26(right.position + 1);

    return turnovers;
}

function rotorSlotToTupleIndex(rotorSlot: "I" | "II" | "III"): 0 | 1 | 2 {
    switch (rotorSlot) {
        case "I":
            return 2;
        case "II":
            return 1;
        case "III":
            return 0;
    }
}

function atNotch(rotor: RotorState): boolean {
    return rotor.position === rotor.notch;
}

function encodeForward(rotor: RotorState, input: number): number {
    const shiftedIn = mod26(input + rotor.position);
    const wired = rotor.wiring[shiftedIn];
    return mod26(wired - rotor.position);
}

function encodeBackward(rotor: RotorState, input: number): number {
    const shiftedIn = mod26(input + rotor.position);
    const wired = rotor.reverseWiring[shiftedIn];
    return mod26(wired - rotor.position);
}

function identityMap(): number[] {
    return Array.from({ length: 26 }, (_, i) => i);
}

function toIndexMap(wiring: string): number[] {
    return [...wiring].map(charToIndex);
}

function invertMap(map: number[]): number[] {
    const inverse = new Array<number>(26);
    for (let i = 0; i < 26; i++) {
        inverse[map[i]] = i;
    }
    return inverse;
}

function charToIndex(ch: string): number {
    return ch.charCodeAt(0) - 65;
}

function indexToChar(i: number): string {
    return String.fromCharCode(i + 65);
}

function isLetter(ch: string): boolean {
    return ch >= "A" && ch <= "Z";
}

function mod26(n: number): number {
    return ((n % 26) + 26) % 26;
}
