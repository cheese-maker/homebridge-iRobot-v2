import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { iRobotPlatformAccessory } from './platformAccessory';
import { getRoombas } from './getRoombas';

/**
 * HomebridgePlatform
 *
 * This class is the main constructor for the iRobot Homebridge plugin.
 */
export class iRobotPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;


    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

    constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);

        this.api.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');

            this.discoverDevices();
        });
    }

    /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    /**
   * Register discovered devices as accessories.
   */
    discoverDevices() {
        if (this.config.email === undefined || this.config.password === undefined) {
            this.log.warn('No email or password provided. Exiting setup');

            return;
        }

        const roombas = getRoombas(this.config.email, this.config.password, this.log, this.config);

        // loop over the discovered devices and register each one if it has not already been registered
        for (const device of roombas) {
            if (this.config.disableMultiRoom) {
                device.multiRoom = false;
            }

            // Use the device's blid as part of the UUID to make sure a unique ID is created
            const uuid = this.api.hap.uuid.generate(device.blid);

            /*
             * See if an accessory with the same uuid has already been registered and restored from
             * the cached devices we stored in the `configureAccessory` method above
            */
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

            if (existingAccessory) {
                // the Roomba already exists
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

                new iRobotPlatformAccessory(this, existingAccessory, device);
            } else {
                if (device.ip === 'undefined') {
                    return;
                }

                // the Roomba does not yet exist, so we need to create it
                this.log.info('Adding new accessory:', device.name);

                // create a new accessory
                const accessory = new this.api.platformAccessory(device.name, uuid);

                accessory.context.device = device;

                new iRobotPlatformAccessory(this, accessory, device);

                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        }
    }
}