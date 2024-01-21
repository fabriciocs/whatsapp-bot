import { DocumentReference, Firestore } from '@google-cloud/firestore';
import * as admin from 'firebase-admin';

// A class to manage contrato at firestore
export default class ContratoManager {

    public static readonly COLLECTION_NAME = 'contrato';
    contratos: Contrato[];

    constructor(private db: Firestore = admin.firestore()) {
        this.contratos = [];
    }
    // get all contratos from firestore
    async getContratos() {
        const contratos = await this.getContratosSnapshot();
        this.contratos = contratos.docs.map((doc) => doc.data());
        return this.contratos;
    }
    getContratosSnapshot = async () => await this.getContratosQuery().get();
    getContratosQuery = () => this.db.collection(ContratoManager.COLLECTION_NAME).where('contract_status', '==', 'Ativo');

    async getContratosRef() {
        const contratos = await this.getContratosSnapshot();
        return contratos?.docs?.map((doc) => doc?.ref);
    }
    // get contrato by id
    async getContrato(id: string) {
        const contrato = await this.db.collection(ContratoManager.COLLECTION_NAME).doc(id).get();
        return contrato.data();
    }
    // get contrato by name
    async getContratoByName(name: string) {
        const contrato = await this.db.collection(ContratoManager.COLLECTION_NAME).where('contract_name', '==', name).get();
        return contrato.docs.map((doc) => doc.data());
    }


    onInit(func: (contratoRef: DocumentReference<Contrato>) => Promise<void>) {
        this.getContratosQuery()
            .onSnapshot((querySnapshot) => {
                Promise.allSettled(querySnapshot.docChanges()
                    .filter(({ type }) => ['added', 'modified'].includes(type))
                    .map(({ doc }) => doc.ref)
                    .map(async (contratoRef) => await func(contratoRef))
                )
            })
    }
}


export class Contrato {
    contract_name?: string;
    contract_date?: Date;
    contract_description?: string;
    contract_status?: string;
    contract_type?: string;
} 