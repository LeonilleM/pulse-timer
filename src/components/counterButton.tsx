type CounterButtonProps = {
    label: string;
    value: number;
    unit: string; // units for mins, sesh
    onIncrement: () => void;
    onDecrement: () => void;
};

const CounterButton: React.FC<CounterButtonProps> = ({
    label,
    value,
    unit,
    onIncrement,
    onDecrement,
}) => {
    return (
        <div className="flex items-center w-full font-inter md:text-4xl text-xs  lg:px-24">
            <h1 className="font-light">{label}</h1>
            <div className="flex flex-row space-x-4 ml-auto">
                <button
                    className=" "
                    onClick={onDecrement}
                >
                    -
                </button>
                <h1 className="font-medium">
                    {value.toString().padStart(2, '0')} {unit}
                </h1>
                <button
                    className=""
                    onClick={onIncrement}
                >
                    +
                </button>

            </div>
        </div>
    );
};

export default CounterButton;