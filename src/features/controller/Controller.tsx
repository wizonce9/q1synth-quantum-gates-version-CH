import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../../app/hooks';
import { Button } from '../buttons/Button';
import { Qubit } from '../qubit/Qubit';
import { SliderGroup } from '../sliderGroup/SliderGroup';
import { WebMidi } from 'webmidi';
import { midiMap } from '../../midi/midiMap'
import { oscSocket } from '../../osc/socket';

import { getIsFullScreen, getMintData, getMode, getDestination, getShouldRecord } from '../../data/dataSlice';
import { getXParams, getYParams, getZParams, setParam, play, stop, getQubit, randomise, setQubitAxis, getDisabled, setDisabled, getMeasureTime } from '../../synthesis/synthesisSlice';
import { getBackend, getIsCollapsing, getQasmStatus } from '../../qasm/qasmSlice';
import { getMidiStatus, getActiveMidiInput } from '../../midi/midiSlice'
import { handleMeasure, MeasureArgs } from '../../qasm/measure';
import { mapToRange } from '../../functions/utils';
import styles from './Controller.module.css';

const appId = new URLSearchParams(window.location.href).get('id') || '0';

export function Controller() {
    const dispatch = useAppDispatch()
    const mode = useAppSelector(getMode)
    const disabled = useAppSelector(getDisabled)
    const isFullScreen = useAppSelector(getIsFullScreen)
    const xParams = useAppSelector(getXParams)
    const yParams = useAppSelector(getYParams)
    const zParams = useAppSelector(getZParams)
    const dur = useAppSelector(getMeasureTime)
    const storedDestination = useAppSelector(getDestination)
    const useQasm = useAppSelector(getQasmStatus)
    const backend = useAppSelector(getBackend)
    const mintData = useAppSelector(getMintData)
    const shouldRecord = useAppSelector(getShouldRecord)
    const qubit = useAppSelector(getQubit)
    const isCollapsing = useAppSelector(getIsCollapsing)
    const midiIsEnabled = useAppSelector(getMidiStatus)
    const midiInput = useAppSelector(getActiveMidiInput)

    const [measureButtonRef, setMeasureButtonRef] = useState<HTMLButtonElement | null>()
    const [playButtonRef, setPlayButtonRef] = useState<HTMLButtonElement | null>()
    const [isPlaying, setIsPlaying] = useState(false)
    const [destination, setDestination] = useState(-1)

    function handleParamChange(id: string, valuesI: number, value: number) {
        dispatch(setParam({id, valuesI, value}))
    }

    function togglePlay() {
        setIsPlaying(!isPlaying)
        isPlaying ? dispatch(stop()) : dispatch(play())
    }

    function handleMeasureClick() {
        dispatch(setDisabled(true))
        const { x, y, z } = qubit

        const measureArgs: MeasureArgs = {
            x: x * 180,
            y: y * 180,
            z: z * 180,
            dur,
            mode,
            isFullScreen,
            destination: destination > -1 ? destination : null,
            storedDestination,
            useQasm,
            mintData,
            backend,
            shouldRecord,
            dispatch
        }

        isPlaying && dispatch(stop())
        setIsPlaying(false)
        handleMeasure(measureArgs)
        setDestination(-1)
    }
    
    useEffect(() => {
        midiIsEnabled 
            && midiInput
            && WebMidi.getInputById(midiInput).addListener('controlchange', e => {
                const { value } = e
                const { number } = e.controller
                const map = midiMap(number)
                const {id, valuesI } = map
                if(!map || !value) return

                // Qubit
                if(number <= 3) return dispatch(setQubitAxis({axis: id, value: mapToRange(+value, 0, 1, -1, 1)}))
                // Params
                if(number <= 45) return dispatch(setParam({id, valuesI: valuesI || 0, value: +value}))
                // Actions
                if(id === 'play') return playButtonRef?.click()
                if(id === 'measure') return measureButtonRef?.click()
                if(id === 'randomise') return dispatch(randomise());
                if(id === 'config') return document.getElementById('config')?.click()
                if(id === 'volume') return dispatch(setParam({id, valuesI: valuesI || 0, value: +value}))
            });
        
            oscSocket.on('message', (message: {address: string, args: {type: string, value: number}[]}) => {
                const {address, args} = message
                const id = address.split('/')[2]
                const action = address.split('/')[3]
                if(+id !== +appId || action !== 'meas') return
            
                const destination: number = (+args[0]?.value || 0);
            
                if([0,1].includes(destination)) {
                    setDestination(destination)
                    measureButtonRef?.click()
                }
            })
    }, [midiIsEnabled, midiInput])
    
    return (
        <>
            <div className={styles.container}>
                {mode === 'advanced' && !isFullScreen &&
                    <section className={`${styles.sliders} sliders`}>
                        <SliderGroup group="xParams" label="|0⟩" params={xParams} onChange={handleParamChange} />
                        <SliderGroup group="yParams" label="|+⟩" params={yParams} onChange={handleParamChange} />
                        <SliderGroup group="zParams" label="|i⟩" params={zParams} onChange={handleParamChange} />
                    </section>
                }
                
                <section 
                    className={`${styles.qubit} ${isFullScreen && styles.qubitFW}`}
                >
                    <Qubit size={isFullScreen ? 500 : 350}/>
                </section>
                
                {mode === 'advanced' && !isFullScreen &&
                    <section className={`${styles.sliders} sliders`}>
                        <SliderGroup group="xParams" label="|1⟩" params={xParams} valuesI={1} onChange={handleParamChange} />
                        <SliderGroup group="yParams" label="|-⟩" params={yParams} valuesI={1} onChange={handleParamChange} />
                        <SliderGroup group="zParams" label="|-i⟩" params={zParams} valuesI={1} onChange={handleParamChange} />
                    </section>
                }
            </div>
            
            <div className={styles.buttons}>
                {mode !== 'presentation' 
                && <Button 
                    name="旋转" 
                    activeName="停止"
                    onClick={togglePlay}
                    isActive={isPlaying}
                    disabled={disabled}
                    setButtonRef={setPlayButtonRef}
                />}
                <Button 
                    name="测量"
                    activeName="测量"
                    onClick={handleMeasureClick}
                    isActive={isCollapsing}
                    disabled={disabled}
                    setButtonRef={setMeasureButtonRef}
                />
            </div>
        
        </>
    )
}