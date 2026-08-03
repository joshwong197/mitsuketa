// Director extraction using NZBN API /entities/{nzbn}/roles endpoint
import { ApiConfig } from '../types.js';

export interface Director {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    fullName?: string;
    appointmentDate?: string;
    designation?: string;
    isCorporate?: boolean;
}

export async function fetchDirectorsFromRolesEndpoint(
    nzbn: string,
    apiKey: string,
    baseUrl: string = '/api/proxy'
): Promise<Director[]> {
    try {
        const proxyPath = `/nzbn/v5/entities/${nzbn}/roles`;
        const rolesUrl = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

        console.log(`Fetching directors from proxy for: ${nzbn}`);

        const response = await fetch(rolesUrl, {
            method: 'GET',
            headers: {
                'x-user-api-key': apiKey || '',
                'x-api-type': 'nzbn',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`Failed to fetch roles: ${response.status}`);
            return [];
        }

        const data = await response.json();

        // Handle multiple response formats
        let roles: any[] = [];
        if (Array.isArray(data)) {
            roles = data;
        } else if (data && Array.isArray(data.roles)) {
            roles = data.roles;
        } else if (data && Array.isArray(data.items)) {
            roles = data.items;
        }

        console.log(`Found ${roles.length} total roles`);

        // Filter for current directors only
        const currentDirectors = roles.filter(role => {
            // Exclude if has end date
            if (role.endDate && role.endDate.trim().length > 0) {
                return false;
            }

            // Include if matches director role type
            const typeCode = (role.roleType || '').toLowerCase();
            const typeDesc = (role.roleTypeDescription || '').toLowerCase();

            return typeCode === 'dir' ||
                typeCode.includes('director') ||
                typeDesc.includes('director');
        });

        console.log(`Found ${currentDirectors.length} current directors`);

        // Extract director information
        const directors: Director[] = currentDirectors.map(role => {
            let name = '';
            let isCorporate = false;
            let firstName = '';
            let lastName = '';
            let middleName = '';

            if (role.rolePerson) {
                // Individual director
                firstName = role.rolePerson.firstName || '';
                lastName = role.rolePerson.lastName || '';
                middleName = role.rolePerson.middleNames || role.rolePerson.otherNames || '';

                name = [firstName, middleName, lastName]
                    .filter(part => part && part.trim().length > 0)
                    .join(' ');

            } else if (role.roleEntity) {
                // Corporate director
                name = role.roleEntity.entityName || 'Unknown Entity';
                isCorporate = true;
            } else {
                name = 'Unknown Name';
            }

            return {
                firstName,
                lastName,
                middleName,
                fullName: name,
                appointmentDate: role.startDate,
                designation: role.roleTypeDescription,
                isCorporate
            };
        });

        return directors;
    } catch (e) {
        console.error("Failed to fetch directors:", e);
        return [];
    }
}

// For backward compatibility with existing code
export async function extractDirectorsFromEntity(_entityDetails: any): Promise<Director[]> {
    // This function is deprecated - we now use fetchDirectorsFromRolesEndpoint
    console.warn('extractDirectorsFromEntity is deprecated - use fetchDirectorsFromRolesEndpoint instead');
    return [];
}
