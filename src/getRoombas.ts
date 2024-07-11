import child_process from 'child_process';
import { Logger, PlatformConfig } from 'homebridge';

export function getRoombas(email: string, password: string, log: Logger, config: PlatformConfig): Robot[] {
    let robots: Robot[] = [];

    if (config.manualDiscovery) {
        log.info('Using manual discovery as per config');
        robots = config.roombas || [];
    } else {
        log.info('Logging into iRobot...');

        const Robots = child_process.execFileSync(__dirname + '/scripts/getRoombaCredentials.js', [email, password]).toString();

        try {
            robots = JSON.parse(Robots);
            log.debug(Robots);
        } catch (e) {
            log.error('Faild to login to iRobot, see below for details');
            log.error(Robots);
        }
    }

    const goodRoombas: Robot[] = [];
    const badRoombas: Robot[] = [];

    robots.forEach(robot => {
        if (robot.autoConfig || !config.autoDiscovery) {
            log.info('Configuring roomba:', robot.name);

            const robotIP = child_process.execFileSync(__dirname + '/scripts/getRoombaIP.js', [robot.blid]).toString();

            try {
                const robotInfo = JSON.parse(robotIP);

                log.debug(robotIP);

                robot.ip = robotInfo.ip;
                delete robotInfo.ip;

                robot.model = getModel(robotInfo.sku);
                robot.multiRoom = getMultiRoom(robot.model);
                robot.info = robotInfo;

                goodRoombas.push(robot);
            } catch (e) {
                try {
                    log.error('Failed to connect roomba:', robot.name, 'with error:', robotIP);
                } finally {
                    badRoombas.push(robot);
                }
            }
        } else {
            log.info('Skipping configuration for roomba:', robot.name, 'due to config');
        }
    });

    for (const roomba of badRoombas) {
        log.warn('Disabling Unconfigured Roomba:', roomba.name);
    }

    return goodRoombas;

}
function getModel(sku: string):string {
    switch (sku.charAt(0)) {
        case 'j':
        case 'i':
        case 's':
            return sku.substring(0, 2);
        case 'R':
            return sku.substring(1, 4);
        default:
            return sku;
    }
}
function getMultiRoom(model:string) {
    switch (model.charAt(0)) {
        case 's':
        case 'j':
            return parseInt(model.charAt(1)) > 4;
        case 'i':
            return parseInt(model.charAt(1)) > 2;
        case 'm':
            return parseInt(model.charAt(1)) === 6;
        default:
            return false;
    }
}
export interface Robot {
  'name': string,
  'blid': string,
  'password': string,
  'autoConfig'?: boolean,
  'ip': string,
  'model': string,
  'multiRoom': boolean,
  'info': {
    'serialNum'?: string,
    'ver'?: string,
    'hostname'?: string,
    'robotname'?: string,
    'robotid'?: string,
    'mac'?: string,
    'sw': string,
    'sku'?: string,
    'nc'?: number,
    'proto'?: string,
    'cap'?: unknown,
  },
}
